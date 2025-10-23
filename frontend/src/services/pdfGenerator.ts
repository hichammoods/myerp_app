import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface Company {
  name: string
  address: string
  city: string
  postalCode: string
  country: string
  phone: string
  email: string
  website?: string
  logo?: string
  siret?: string
  tva?: string
}

interface Client {
  name: string
  company?: string
  address: string
  city: string
  postalCode: string
  country: string
  phone?: string
  email?: string
}

interface QuotationItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  discount?: number
  discountType?: 'percent' | 'amount'
  tax: number
  total: number
}

interface Quotation {
  id: string
  number: string
  date: Date
  validUntil: Date
  client: Client
  items: QuotationItem[]
  subtotal: number
  totalDiscount: number
  totalTax: number
  total: number
  notes?: string
  termsAndConditions?: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
}

export class PDFGenerator {
  private doc: jsPDF
  private pageHeight = 297 // A4 height in mm
  private pageWidth = 210 // A4 width in mm
  private margin = 20
  private currentY = 20
  private lineHeight = 7
  private primaryColor = '#2563eb' // Blue-600
  private textColor = '#111827' // Gray-900
  private lightGray = '#9ca3af' // Gray-400

  constructor() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })
  }

  private resetDoc() {
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    })
    this.currentY = this.margin
  }

  private addNewPageIfNeeded(requiredSpace: number = 30) {
    if (this.currentY + requiredSpace > this.pageHeight - this.margin) {
      this.doc.addPage()
      this.currentY = this.margin
      return true
    }
    return false
  }

  private drawHeader(company: Company, quotation: Quotation) {
    // Company Logo and Info
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(20)
    this.doc.setTextColor(this.primaryColor)
    this.doc.text(company.name, this.margin, this.currentY)

    this.currentY += 8
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(10)
    this.doc.setTextColor(this.textColor)
    this.doc.text(company.address, this.margin, this.currentY)

    this.currentY += 5
    this.doc.text(`${company.postalCode} ${company.city}, ${company.country}`, this.margin, this.currentY)

    this.currentY += 5
    if (company.phone) {
      this.doc.text(`Tél: ${company.phone}`, this.margin, this.currentY)
      this.currentY += 5
    }
    if (company.email) {
      this.doc.text(`Email: ${company.email}`, this.margin, this.currentY)
      this.currentY += 5
    }
    if (company.website) {
      this.doc.text(`Web: ${company.website}`, this.margin, this.currentY)
      this.currentY += 5
    }

    // SIRET and TVA on the right
    if (company.siret || company.tva) {
      let rightY = 25
      this.doc.setFontSize(9)
      this.doc.setTextColor(this.lightGray)

      if (company.siret) {
        this.doc.text(`SIRET: ${company.siret}`, this.pageWidth - this.margin, rightY, { align: 'right' })
        rightY += 4
      }
      if (company.tva) {
        this.doc.text(`TVA: ${company.tva}`, this.pageWidth - this.margin, rightY, { align: 'right' })
      }
    }

    // Quotation Title
    this.currentY += 10
    this.doc.setDrawColor(this.primaryColor)
    this.doc.setLineWidth(0.5)
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY)

    this.currentY += 10
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(24)
    this.doc.setTextColor(this.primaryColor)
    this.doc.text('DEVIS', this.pageWidth / 2, this.currentY, { align: 'center' })

    this.currentY += 8
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(12)
    this.doc.setTextColor(this.textColor)
    this.doc.text(`N° ${quotation.number}`, this.pageWidth / 2, this.currentY, { align: 'center' })

    this.currentY += 10
    this.doc.setLineWidth(0.5)
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY)
    this.currentY += 10
  }

  private drawClientInfo(client: Client, quotation: Quotation) {
    // Date and validity on the left
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(10)
    this.doc.setTextColor(this.textColor)
    this.doc.text('Date du devis:', this.margin, this.currentY)

    this.doc.setFont('helvetica', 'normal')
    this.doc.text(
      quotation.date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      this.margin + 30,
      this.currentY
    )

    this.currentY += 5
    this.doc.setFont('helvetica', 'bold')
    this.doc.text('Valide jusqu\'au:', this.margin, this.currentY)

    this.doc.setFont('helvetica', 'normal')
    this.doc.text(
      quotation.validUntil.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      this.margin + 30,
      this.currentY
    )

    // Client info on the right
    const clientBoxX = this.pageWidth / 2 + 10
    const clientBoxY = this.currentY - 5
    const clientBoxWidth = this.pageWidth - this.margin - clientBoxX
    const clientBoxHeight = 35

    // Draw client box
    this.doc.setDrawColor(this.lightGray)
    this.doc.setLineWidth(0.3)
    this.doc.rect(clientBoxX, clientBoxY - 10, clientBoxWidth, clientBoxHeight)

    // Client title
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(10)
    this.doc.setTextColor(this.primaryColor)
    this.doc.text('CLIENT', clientBoxX + 5, clientBoxY - 5)

    // Client details
    let clientY = clientBoxY + 2
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(10)
    this.doc.setTextColor(this.textColor)
    this.doc.text(client.name, clientBoxX + 5, clientY)

    clientY += 5
    if (client.company) {
      this.doc.setFont('helvetica', 'normal')
      this.doc.text(client.company, clientBoxX + 5, clientY)
      clientY += 5
    }

    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(9)
    this.doc.text(client.address, clientBoxX + 5, clientY)

    clientY += 4
    this.doc.text(`${client.postalCode} ${client.city}`, clientBoxX + 5, clientY)

    if (client.phone) {
      clientY += 4
      this.doc.text(`Tél: ${client.phone}`, clientBoxX + 5, clientY)
    }

    if (client.email) {
      clientY += 4
      this.doc.text(client.email, clientBoxX + 5, clientY)
    }

    this.currentY = Math.max(this.currentY + 10, clientBoxY + clientBoxHeight)
  }

  private drawItemsTable(items: QuotationItem[]) {
    this.currentY += 10

    // Table headers
    const headers = ['Description', 'Qté', 'Prix Unit.', 'Remise', 'TVA', 'Total HT']
    const columnWidths = [80, 15, 25, 20, 20, 30]
    const tableX = this.margin

    // Draw header background
    this.doc.setFillColor(this.primaryColor)
    this.doc.rect(tableX, this.currentY, this.pageWidth - 2 * this.margin, 8, 'F')

    // Draw header text
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(10)
    this.doc.setTextColor('#ffffff')

    let currentX = tableX
    headers.forEach((header, index) => {
      this.doc.text(header, currentX + 2, this.currentY + 5.5)
      currentX += columnWidths[index]
    })

    this.currentY += 8

    // Draw items
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(9)
    this.doc.setTextColor(this.textColor)

    items.forEach((item, index) => {
      this.addNewPageIfNeeded(20)

      // Alternate row background
      if (index % 2 === 1) {
        this.doc.setFillColor('#f9fafb')
        this.doc.rect(tableX, this.currentY, this.pageWidth - 2 * this.margin, 7, 'F')
      }

      currentX = tableX

      // Description (can be multiline)
      const descriptionLines = this.doc.splitTextToSize(item.description, columnWidths[0] - 4)
      const lineCount = descriptionLines.length

      descriptionLines.forEach((line, lineIndex) => {
        this.doc.text(line, currentX + 2, this.currentY + 5 + (lineIndex * 4))
      })

      currentX += columnWidths[0]

      // Quantity
      this.doc.text(item.quantity.toString(), currentX + 2, this.currentY + 5)
      currentX += columnWidths[1]

      // Unit price
      this.doc.text(`${item.unitPrice.toFixed(2)} €`, currentX + 2, this.currentY + 5)
      currentX += columnWidths[2]

      // Discount
      if (item.discount) {
        const discountText = item.discountType === 'percent'
          ? `${item.discount}%`
          : `${item.discount.toFixed(2)} €`
        this.doc.text(discountText, currentX + 2, this.currentY + 5)
      } else {
        this.doc.text('-', currentX + 2, this.currentY + 5)
      }
      currentX += columnWidths[3]

      // Tax
      this.doc.text(`${item.tax}%`, currentX + 2, this.currentY + 5)
      currentX += columnWidths[4]

      // Total
      this.doc.setFont('helvetica', 'bold')
      this.doc.text(`${item.total.toFixed(2)} €`, currentX + 2, this.currentY + 5)
      this.doc.setFont('helvetica', 'normal')

      this.currentY += Math.max(7, lineCount * 4 + 3)

      // Draw separator line
      this.doc.setDrawColor(this.lightGray)
      this.doc.setLineWidth(0.1)
      this.doc.line(tableX, this.currentY, this.pageWidth - this.margin, this.currentY)
      this.currentY += 1
    })
  }

  private drawTotals(quotation: Quotation) {
    this.currentY += 10

    const totalsX = this.pageWidth - this.margin - 70
    const labelX = totalsX - 30

    // Subtotal
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(10)
    this.doc.setTextColor(this.textColor)
    this.doc.text('Sous-total HT:', labelX, this.currentY, { align: 'right' })
    this.doc.text(`${quotation.subtotal.toFixed(2)} €`, totalsX + 60, this.currentY, { align: 'right' })

    this.currentY += 6

    // Discount if any
    if (quotation.totalDiscount > 0) {
      this.doc.text('Remise totale:', labelX, this.currentY, { align: 'right' })
      this.doc.text(`-${quotation.totalDiscount.toFixed(2)} €`, totalsX + 60, this.currentY, { align: 'right' })
      this.currentY += 6
    }

    // Tax
    this.doc.text('TVA:', labelX, this.currentY, { align: 'right' })
    this.doc.text(`${quotation.totalTax.toFixed(2)} €`, totalsX + 60, this.currentY, { align: 'right' })

    this.currentY += 8

    // Draw total line
    this.doc.setDrawColor(this.primaryColor)
    this.doc.setLineWidth(0.5)
    this.doc.line(labelX - 20, this.currentY, totalsX + 60, this.currentY)

    this.currentY += 8

    // Total
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(12)
    this.doc.setTextColor(this.primaryColor)
    this.doc.text('TOTAL TTC:', labelX, this.currentY, { align: 'right' })
    this.doc.text(`${quotation.total.toFixed(2)} €`, totalsX + 60, this.currentY, { align: 'right' })
  }

  private drawFooter(quotation: Quotation) {
    // Notes
    if (quotation.notes) {
      this.currentY += 20
      this.addNewPageIfNeeded(40)

      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(10)
      this.doc.setTextColor(this.textColor)
      this.doc.text('Notes:', this.margin, this.currentY)

      this.currentY += 5
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(9)
      const notesLines = this.doc.splitTextToSize(quotation.notes, this.pageWidth - 2 * this.margin)
      notesLines.forEach(line => {
        this.doc.text(line, this.margin, this.currentY)
        this.currentY += 4
      })
    }

    // Terms and conditions
    if (quotation.termsAndConditions) {
      this.currentY += 10
      this.addNewPageIfNeeded(40)

      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(10)
      this.doc.setTextColor(this.textColor)
      this.doc.text('Conditions générales:', this.margin, this.currentY)

      this.currentY += 5
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(8)
      const termsLines = this.doc.splitTextToSize(quotation.termsAndConditions, this.pageWidth - 2 * this.margin)
      termsLines.forEach(line => {
        this.doc.text(line, this.margin, this.currentY)
        this.currentY += 3.5
      })
    }

    // Signature boxes
    this.currentY = this.pageHeight - 50

    // Client signature box
    const sigBoxWidth = 70
    const sigBoxHeight = 30

    this.doc.setDrawColor(this.lightGray)
    this.doc.setLineWidth(0.3)
    this.doc.rect(this.margin, this.currentY, sigBoxWidth, sigBoxHeight)

    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(9)
    this.doc.setTextColor(this.textColor)
    this.doc.text('Signature du client:', this.margin + 2, this.currentY - 2)
    this.doc.text('Date:', this.margin + 2, this.currentY + sigBoxHeight + 4)

    // Company signature box
    this.doc.rect(this.pageWidth - this.margin - sigBoxWidth, this.currentY, sigBoxWidth, sigBoxHeight)
    this.doc.text('Signature et cachet:', this.pageWidth - this.margin - sigBoxWidth + 2, this.currentY - 2)
    this.doc.text('Date:', this.pageWidth - this.margin - sigBoxWidth + 2, this.currentY + sigBoxHeight + 4)

    // Footer text
    this.doc.setFontSize(8)
    this.doc.setTextColor(this.lightGray)
    this.doc.text(
      'Ce devis est valable pour une durée de 30 jours à compter de sa date d\'émission.',
      this.pageWidth / 2,
      this.pageHeight - 10,
      { align: 'center' }
    )
  }

  public generateQuotationPDF(
    company: Company,
    quotation: Quotation,
    download: boolean = true,
    filename?: string
  ): jsPDF {
    this.resetDoc()

    // Draw all sections
    this.drawHeader(company, quotation)
    this.drawClientInfo(quotation.client, quotation)
    this.drawItemsTable(quotation.items)
    this.drawTotals(quotation)
    this.drawFooter(quotation)

    // Add page numbers
    const pageCount = this.doc.getNumberOfPages()
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(8)
    this.doc.setTextColor(this.lightGray)

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i)
      this.doc.text(
        `Page ${i} / ${pageCount}`,
        this.pageWidth / 2,
        this.pageHeight - 5,
        { align: 'center' }
      )
    }

    // Save or return
    if (download) {
      const defaultFilename = `Devis_${quotation.number}_${quotation.client.name.replace(/\s+/g, '_')}.pdf`
      this.doc.save(filename || defaultFilename)
    }

    return this.doc
  }

  public async generateFromHTML(elementId: string, filename: string = 'document.pdf') {
    const element = document.getElementById(elementId)
    if (!element) {
      throw new Error(`Element with id ${elementId} not found`)
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
    })

    const imgData = canvas.toDataURL('image/png')
    const imgWidth = 210
    const pageHeight = 295
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    const pdf = new jsPDF('p', 'mm', 'a4')
    let position = 0

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    pdf.save(filename)
    return pdf
  }
}

// Export a singleton instance
export const pdfGenerator = new PDFGenerator()

// Helper function for quick PDF generation
export const generateQuotationPDF = (
  company: Company,
  quotation: Quotation,
  download: boolean = true,
  filename?: string
) => {
  const generator = new PDFGenerator()
  return generator.generateQuotationPDF(company, quotation, download, filename)
}