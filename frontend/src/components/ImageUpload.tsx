import React, { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  X,
  Image as ImageIcon,
  Trash2,
  Star,
  Eye,
  Download,
  RotateCw,
  ZoomIn,
  AlertCircle
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface ImageFile {
  id: string
  file?: File
  url?: string
  name: string
  size: number
  type: string
  isMain: boolean
  preview?: string
  uploading?: boolean
  error?: string
}

interface ImageUploadProps {
  images?: ImageFile[]
  onImagesChange: (images: ImageFile[]) => void
  maxImages?: number
  maxSize?: number // in MB
  acceptedTypes?: string[]
  multiple?: boolean
  showGallery?: boolean
  productName?: string
  productId?: string // For real uploads
  onUploadSuccess?: (image: any) => void
}

export function ImageUpload({
  images = [],
  onImagesChange,
  maxImages = 10,
  maxSize = 5, // 5MB default
  acceptedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  multiple = true,
  showGallery = true,
  productName = 'Product',
  productId,
  onUploadSuccess
}: ImageUploadProps) {
  const [dragging, setDragging] = useState(false)
  const [previewImage, setPreviewImage] = useState<ImageFile | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef<ImageFile[]>(images)

  // Keep ref in sync with prop
  React.useEffect(() => {
    imagesRef.current = images
  }, [images])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)

    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      handleFiles(files)
    }
  }

  const handleFiles = (files: File[]) => {
    console.log('handleFiles called with', files.length, 'files, productId:', productId)
    // Filter valid files
    const validFiles = files.filter(file => {
      // Check file type
      if (!acceptedTypes.includes(file.type)) {
        toast.error(`${file.name} n'est pas un type d'image supporté`)
        return false
      }

      // Check file size
      if (file.size > maxSize * 1024 * 1024) {
        toast.error(`${file.name} dépasse la taille maximale de ${maxSize}MB`)
        return false
      }

      return true
    })

    // Check max images limit
    const remainingSlots = maxImages - images.length
    if (validFiles.length > remainingSlots) {
      toast.error(`Vous ne pouvez ajouter que ${remainingSlots} image(s) supplémentaire(s)`)
      validFiles.splice(remainingSlots)
    }

    // Create image objects
    const newImages: ImageFile[] = validFiles.map((file, index) => {
      const imageId = `img-${Date.now()}-${index}`
      const reader = new FileReader()

      reader.onload = (e) => {
        const updatedImages = imagesRef.current.map(img =>
          img.id === imageId ? { ...img, preview: e.target?.result as string } : img
        )
        onImagesChange(updatedImages as ImageFile[])
      }
      reader.readAsDataURL(file)

      return {
        id: imageId,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        isMain: images.length === 0 && index === 0, // First image is main by default
        uploading: true
      }
    })

    // Add to existing images
    console.log('Adding', newImages.length, 'new images. Current images:', images.length)
    onImagesChange([...images, ...newImages])

    // Upload each image
    console.log('Starting uploads for', newImages.length, 'images')
    newImages.forEach(img => {
      if (img.file) {
        console.log('Uploading image:', img.id, 'productId:', productId)
        uploadToServer(img.id, img.file)
      }
    })
  }

  const uploadToServer = async (imageId: string, file: File) => {
    console.log('uploadToServer called for imageId:', imageId, 'file:', file.name, 'productId:', productId)
    if (!productId) {
      // If no productId, use simulation (for new products not yet saved)
      console.log('No productId, using simulation')
      simulateUpload(imageId)
      return
    }

    console.log('productId exists, starting real upload to:', `http://localhost:4000/api/products/${productId}/upload-image`)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const xhr = new XMLHttpRequest()

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100)
          setUploadProgress(prev => ({ ...prev, [imageId]: progress }))
        }
      })

      xhr.addEventListener('load', () => {
        console.log('Upload complete, status:', xhr.status, 'imageId:', imageId)
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText)
          const uploadedImage = response.image
          console.log('Upload successful, image:', uploadedImage)

          // Update image with server URL - use ref to get fresh state
          const updatedImages = imagesRef.current.map(img =>
            img.id === imageId
              ? {
                  ...img,
                  uploading: false,
                  url: uploadedImage.url,
                  filename: uploadedImage.filename,
                }
              : img
          )
          console.log('Updated images:', updatedImages)
          onImagesChange(updatedImages)
          toast.success('Image téléchargée avec succès')

          if (onUploadSuccess) {
            onUploadSuccess(uploadedImage)
          }
        } else {
          console.error('Upload failed with status:', xhr.status)
          throw new Error('Upload failed')
        }
      })

      xhr.addEventListener('error', () => {
        console.error('XHR error for imageId:', imageId)
        const updatedImages = imagesRef.current.filter(img => img.id !== imageId)
        onImagesChange(updatedImages)
        toast.error('Erreur lors du téléchargement de l\'image')
      })

      const token = localStorage.getItem('access_token')
      xhr.open('POST', `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/products/${productId}/upload-image`)
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }
      xhr.send(formData)
    } catch (error) {
      console.error('Upload catch error:', error)
      const updatedImages = imagesRef.current.filter(img => img.id !== imageId)
      onImagesChange(updatedImages)
      toast.error('Erreur lors du téléchargement de l\'image')
    }
  }

  const simulateUpload = (imageId: string) => {
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setUploadProgress(prev => ({ ...prev, [imageId]: progress }))

      if (progress >= 100) {
        clearInterval(interval)
        const updatedImages = imagesRef.current.map(img =>
          img.id === imageId
            ? { ...img, uploading: false, url: `/uploads/${img.name}` }
            : img
        )
        onImagesChange(updatedImages)
        toast.success('Image préparée (sera téléchargée à la sauvegarde)')
      }
    }, 200)
  }

  const handleRemoveImage = (imageId: string) => {
    const updatedImages = images.filter(img => img.id !== imageId)

    // If we removed the main image, set the first remaining image as main
    if (updatedImages.length > 0 && !updatedImages.some(img => img.isMain)) {
      updatedImages[0].isMain = true
    }

    onImagesChange(updatedImages)
    toast.success('Image supprimée')
  }

  const handleSetMainImage = (imageId: string) => {
    const updatedImages = images.map(img => ({
      ...img,
      isMain: img.id === imageId
    }))
    onImagesChange(updatedImages)
    toast.success('Image principale définie')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-gray-300",
          "cursor-pointer hover:border-primary hover:bg-gray-50"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="p-8 text-center">
          <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2">
            Glissez et déposez vos images ici
          </p>
          <p className="text-sm text-gray-500 mb-4">
            ou cliquez pour sélectionner des fichiers
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-500">
            <span>Formats acceptés: {acceptedTypes.map(t => t.split('/')[1]).join(', ')}</span>
            <span>•</span>
            <span>Taille max: {maxSize}MB</span>
            <span>•</span>
            <span>Max {maxImages} images</span>
          </div>
        </div>
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={acceptedTypes.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Image Gallery */}
      {showGallery && images.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Images du produit ({images.length}/{maxImages})</h3>
            {images.length > 1 && (
              <p className="text-sm text-gray-500">
                <Star className="h-3 w-3 inline mr-1" />
                Cliquez sur l'étoile pour définir l'image principale
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {images.map((image) => (
              <Card key={image.id} className="relative group overflow-hidden">
                {/* Image */}
                <div className="aspect-square bg-gray-100 relative">
                  {image.preview || image.url ? (
                    <img
                      src={image.preview || image.url}
                      alt={image.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-gray-400" />
                    </div>
                  )}

                  {/* Upload Progress */}
                  {image.uploading && uploadProgress[image.id] !== undefined && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="text-white text-center">
                        <RotateCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                        <p className="text-sm">{uploadProgress[image.id]}%</p>
                      </div>
                    </div>
                  )}

                  {/* Main Badge */}
                  {image.isMain && (
                    <Badge className="absolute top-2 left-2 bg-yellow-500">
                      <Star className="h-3 w-3 mr-1" />
                      Principale
                    </Badge>
                  )}

                  {/* Actions Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!image.isMain && images.length > 1 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSetMainImage(image.id)
                        }}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewImage(image)
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveImage(image.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Image Info */}
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{image.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(image.size)}</p>
                  {image.error && (
                    <div className="flex items-center gap-1 text-xs text-red-500 mt-1">
                      <AlertCircle className="h-3 w-3" />
                      {image.error}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewImage?.name}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <img
              src={previewImage?.preview || previewImage?.url}
              alt={previewImage?.name}
              className="w-full h-auto rounded-lg"
            />
            {previewImage?.isMain && (
              <Badge className="absolute top-4 left-4 bg-yellow-500">
                <Star className="h-3 w-3 mr-1" />
                Image principale
              </Badge>
            )}
          </div>
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-500">
              <p>Taille: {formatFileSize(previewImage?.size || 0)}</p>
              <p>Type: {previewImage?.type}</p>
            </div>
            <div className="flex gap-2">
              {previewImage?.url && (
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </Button>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (previewImage) {
                    handleRemoveImage(previewImage.id)
                    setPreviewImage(null)
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}