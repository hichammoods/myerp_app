import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader } from 'lucide-react';
import { productsApi } from '../services/api';
import toast from 'react-hot-toast';

interface CustomComponent {
  component_name: string;
  component_type: 'material' | 'finish';
  material_id?: string;
  finish_id?: string;
  quantity: number;
  unit_cost: number;
  upcharge_percentage: number;
  notes?: string;
}

interface ProductComponent {
  id: string;
  component_name: string;
  quantity: number;
  unit_of_measure: string;
  material_id: string | null;
  material_name: string | null;
  material_price: number | null;
  material_upcharge: number | null;
  finish_id: string | null;
  finish_name: string | null;
  finish_cost: number | null;
  finish_upcharge: number | null;
  extra_cost: number | null;
  notes: string | null;
}

interface ProductCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    name: string;
    price_ht: number;
    sku?: string;
  };
  onConfirm: (customizedProduct: {
    product_id: string;
    product_name: string;
    product_sku: string;
    unit_price: number;
    is_customized: boolean;
    base_product_id: string;
    custom_components: CustomComponent[];
    quantity: number;
  }) => void;
}

const ProductCustomizationModal: React.FC<ProductCustomizationModalProps> = ({
  isOpen,
  onClose,
  product,
  onConfirm,
}) => {
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [finishes, setFinishes] = useState<any[]>([]);
  const [customComponents, setCustomComponents] = useState<CustomComponent[]>([]);
  const [customPrice, setCustomPrice] = useState<number>(product.price_ht || product.totalPrice || product.basePrice || product.unit_price || 0);
  const [priceBreakdown, setPriceBreakdown] = useState<any>(null);

  // Get the base price from product
  const basePrice = product.price_ht || product.totalPrice || product.basePrice || product.unit_price || 0;

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, product.id]);

  useEffect(() => {
    if (customComponents.length > 0) {
      calculatePrice();
    }
  }, [customComponents]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load product components
      const componentsData = await productsApi.getProductComponents(product.id);

      // Load all materials and finishes
      const [materialsData, finishesData] = await Promise.all([
        productsApi.getMaterials(),
        productsApi.getFinishes(),
      ]);

      setComponents(componentsData.components || []);
      setMaterials(materialsData);
      setFinishes(finishesData);

      // Check if we're editing an existing customization
      if (product.existing_custom_components && product.existing_custom_components.length > 0) {
        // Enrich existing custom components with material and finish names
        const enrichedExisting = product.existing_custom_components.map((comp: any) => {
          const material = comp.material_id ? materialsData.find((m: any) => m.id === comp.material_id) : null;
          const finish = comp.finish_id ? finishesData.find((f: any) => f.id === comp.finish_id) : null;

          return {
            ...comp,
            material_name: material?.name || comp.material_name || null,
            finish_name: finish?.name || comp.finish_name || null
          };
        });
        setCustomComponents(enrichedExisting);
      } else {
        // Initialize custom components from product defaults
        const initialCustomComponents: CustomComponent[] = (componentsData.components || []).map((comp: ProductComponent) => ({
          component_name: comp.component_name,
          component_type: 'material' as const,
          material_id: comp.material_id || undefined,
          finish_id: comp.finish_id || undefined,
          quantity: comp.quantity,
          unit_cost: comp.material_price || 0,
          upcharge_percentage: comp.material_upcharge || 0,
          notes: comp.notes || '',
        }));

        setCustomComponents(initialCustomComponents);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = async () => {
    if (customComponents.length === 0) return;

    try {
      setCalculating(true);
      const payload = {
        product_id: product.id,
        base_price: basePrice,
        custom_components: customComponents.map(comp => ({
          component_name: comp.component_name,
          material_id: comp.material_id,
          finish_id: comp.finish_id,
        })),
      };

      const result = await productsApi.calculateCustomPrice(payload);

      if (result.success) {
        setCustomPrice(result.pricing.custom_price);
        setPriceBreakdown(result.pricing);
      }
    } catch (error: any) {
      console.error('Error calculating price:', error);
      toast.error('Erreur lors du calcul du prix');
    } finally {
      setCalculating(false);
    }
  };

  const handleMaterialChange = (index: number, materialId: string) => {
    const material = materials.find(m => m.id === materialId);
    const updatedComponents = [...customComponents];
    updatedComponents[index] = {
      ...updatedComponents[index],
      material_id: materialId,
      unit_cost: material?.cost_per_unit || 0,
      upcharge_percentage: material?.upcharge_percentage || 0,
    };
    setCustomComponents(updatedComponents);
  };

  const handleFinishChange = (index: number, finishId: string) => {
    const finish = finishes.find(f => f.id === finishId);
    const updatedComponents = [...customComponents];
    updatedComponents[index] = {
      ...updatedComponents[index],
      finish_id: finishId,
      upcharge_percentage: finish?.upcharge_percentage || 0,
    };
    setCustomComponents(updatedComponents);
  };

  const handleAddComponent = () => {
    setCustomComponents([
      ...customComponents,
      {
        component_name: '',
        component_type: 'material',
        quantity: 1,
        unit_cost: 0,
        upcharge_percentage: 0,
        notes: '',
      },
    ]);
  };

  const handleRemoveComponent = (index: number) => {
    const updatedComponents = customComponents.filter((_, i) => i !== index);
    setCustomComponents(updatedComponents);
  };

  const handleConfirm = () => {
    if (customComponents.length === 0) {
      toast.error('Veuillez ajouter au moins un composant personnalisé');
      return;
    }

    // Enrich custom components with material and finish names
    const enrichedComponents = customComponents.map(comp => {
      const material = comp.material_id ? materials.find(m => m.id === comp.material_id) : null;
      const finish = comp.finish_id ? finishes.find(f => f.id === comp.finish_id) : null;

      return {
        ...comp,
        material_name: material?.name || null,
        finish_name: finish?.name || null
      };
    });

    onConfirm({
      product_id: product.id,
      product_name: `${product.name} (Personnalisé)`,
      product_sku: `${product.sku || 'CUSTOM'}-001`,
      unit_price: customPrice,
      is_customized: true,
      base_product_id: product.id,
      custom_components: enrichedComponents,
      quantity: 1,
    });

    onClose();
    const isEditing = product.existing_custom_components && product.existing_custom_components.length > 0;
    toast.success(isEditing ? 'Produit personnalisé modifié' : 'Produit personnalisé ajouté au devis');
  };

  if (!isOpen) return null;

  const isEditing = product.existing_custom_components && product.existing_custom_components.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Modifier la personnalisation' : 'Personnaliser le produit'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {product.name} - Prix de base: {(product.price_ht || product.totalPrice || product.basePrice || product.unit_price || 0).toFixed(2)} €
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Components List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Composants personnalisables
                  </h3>
                  <button
                    onClick={handleAddComponent}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter un composant
                  </button>
                </div>

                <div className="space-y-4">
                  {customComponents.map((comp, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Nom du composant
                            </label>
                            <input
                              type="text"
                              value={comp.component_name}
                              onChange={(e) => {
                                const updated = [...customComponents];
                                updated[index].component_name = e.target.value;
                                setCustomComponents(updated);
                              }}
                              placeholder="Ex: Assise, Structure, Pieds..."
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Quantité
                            </label>
                            <input
                              type="number"
                              value={comp.quantity}
                              onChange={(e) => {
                                const updated = [...customComponents];
                                updated[index].quantity = parseFloat(e.target.value) || 0;
                                setCustomComponents(updated);
                              }}
                              min="0"
                              step="0.01"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveComponent(index)}
                          className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Matériau
                          </label>
                          <select
                            value={comp.material_id || ''}
                            onChange={(e) => handleMaterialChange(index, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="">Sélectionner un matériau</option>
                            {materials.map((material) => (
                              <option key={material.id} value={material.id}>
                                {material.name}
                                {material.upcharge_percentage > 0 &&
                                  ` (+${material.upcharge_percentage}%)`}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Finition
                          </label>
                          <select
                            value={comp.finish_id || ''}
                            onChange={(e) => handleFinishChange(index, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="">Sélectionner une finition</option>
                            {finishes.map((finish) => (
                              <option key={finish.id} value={finish.id}>
                                {finish.name}
                                {finish.upcharge_percentage > 0 &&
                                  ` (+${finish.upcharge_percentage}%)`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <textarea
                          value={comp.notes || ''}
                          onChange={(e) => {
                            const updated = [...customComponents];
                            updated[index].notes = e.target.value;
                            setCustomComponents(updated);
                          }}
                          rows={2}
                          placeholder="Notes additionnelles..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  ))}

                  {customComponents.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      Aucun composant personnalisé. Cliquez sur "Ajouter un composant" pour commencer.
                    </div>
                  )}
                </div>
              </div>

              {/* Price Breakdown */}
              {priceBreakdown && (
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Détail du prix
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Prix de base:</span>
                      <span className="font-medium">{(priceBreakdown.base_price || 0).toFixed(2)} €</span>
                    </div>
                    {priceBreakdown.component_details?.map((detail: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {detail.component_name} - {detail.name} ({detail.type}):
                        </span>
                        <span className="font-medium text-indigo-600">
                          +{(detail.upcharge_amount || 0).toFixed(2)} € ({detail.upcharge_percentage || 0}%)
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-indigo-300 pt-2 mt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Supplément total:</span>
                        <span className="font-medium text-indigo-600">
                          +{(priceBreakdown.total_upcharge || 0).toFixed(2)} €
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-indigo-300 pt-2 mt-2">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Prix personnalisé:</span>
                        <span className="text-indigo-600">
                          {(customPrice || 0).toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || calculating || customComponents.length === 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {calculating && <Loader className="w-4 h-4 animate-spin" />}
            {isEditing ? 'Enregistrer les modifications' : 'Confirmer la personnalisation'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCustomizationModal;
