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
  shippingCost?: number
  installationCost?: number
  totalTax: number
  total: number
  notes?: string
  termsAndConditions?: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
}

interface SalesOrder {
  id: string
  orderNumber: string
  orderDate: Date
  expectedDeliveryDate?: Date
  quotationNumber?: string  // Cross-reference to quotation
  client: Client
  items: QuotationItem[]
  subtotal: number
  totalDiscount: number
  shippingCost?: number
  installationCost?: number
  totalTax: number
  total: number
  downPaymentAmount?: number
  downPaymentMethod?: string
  downPaymentDate?: Date
  downPaymentNotes?: string
  notes?: string
  termsAndConditions?: string
  deliveryAddress?: string
  status: string
}

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceDate: Date
  dueDate?: Date
  quotationNumber?: string  // Cross-reference to quotation
  orderNumber?: string      // Cross-reference to sales order
  client: Client
  items: QuotationItem[]
  subtotal: number
  totalDiscount: number
  shippingCost?: number
  installationCost?: number
  totalTax: number
  total: number
  downPaymentAmount?: number
  downPaymentMethod?: string
  downPaymentDate?: Date
  downPaymentNotes?: string
  amountPaid?: number
  amountDue?: number
  notes?: string
  termsAndConditions?: string
  paymentTerms?: string
  status: string
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

  private formatPaymentTerms(terms: string | undefined): string {
    if (!terms) return ''

    // If it's just a number, format it as "Paiement sous X jours"
    if (/^\d+$/.test(terms.trim())) {
      return `Paiement sous ${terms} jours`
    }

    // Otherwise return as-is
    return terms
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
    // Quotation Number and Title in top left - compact
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(16)
    this.doc.setTextColor(this.primaryColor)
    this.doc.text('DEVIS', this.margin, this.currentY)

    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(11)
    this.doc.text(`N° ${quotation.number}`, this.margin + 25, this.currentY)

    // Company info on the right - compact
    let rightY = this.currentY
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(12)
    this.doc.setTextColor(this.primaryColor)
    this.doc.text(company.name, this.pageWidth - this.margin, rightY, { align: 'right' })

    rightY += 5
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(8)
    this.doc.setTextColor(this.textColor)
    this.doc.text(company.address, this.pageWidth - this.margin, rightY, { align: 'right' })

    rightY += 4
    this.doc.text(`${company.postalCode} ${company.city}`, this.pageWidth - this.margin, rightY, { align: 'right' })

    rightY += 4
    if (company.phone) {
      this.doc.text(`Tél: ${company.phone}`, this.pageWidth - this.margin, rightY, { align: 'right' })
      rightY += 4
    }
    if (company.email) {
      this.doc.text(`Email: ${company.email}`, this.pageWidth - this.margin, rightY, { align: 'right' })
      rightY += 4
    }

    // SIRET and TVA below company info
    if (company.siret || company.tva) {
      this.doc.setFontSize(7)
      this.doc.setTextColor(this.lightGray)

      if (company.siret) {
        this.doc.text(`SIRET: ${company.siret}`, this.pageWidth - this.margin, rightY, { align: 'right' })
        rightY += 3
      }
      if (company.tva) {
        this.doc.text(`TVA: ${company.tva}`, this.pageWidth - this.margin, rightY, { align: 'right' })
      }
    }

    // Set currentY to the max of left and right sections
    this.currentY = Math.max(this.currentY + 8, rightY + 4)

    // Separator line
    this.doc.setDrawColor(this.primaryColor)
    this.doc.setLineWidth(0.3)
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY)
    this.currentY += 6
  }

  private drawClientInfo(client: Client, quotation: Quotation, labelForSecondDate: string = 'Validité:') {
    // Add some space after the separator line
    this.currentY += 2

    // Date and validity on the left - compact
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(9)
    this.doc.setTextColor(this.textColor)
    this.doc.text('Date:', this.margin, this.currentY)

    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(8)
    this.doc.text(
      quotation.date.toLocaleDateString('fr-FR'),
      this.margin + 20,
      this.currentY
    )

    this.currentY += 4
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(9)
    this.doc.text(labelForSecondDate, this.margin, this.currentY)

    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(8)
    this.doc.text(
      quotation.validUntil.toLocaleDateString('fr-FR'),
      this.margin + 58,
      this.currentY
    )

    // Client info on the right - compact box (positioned lower)
    const clientBoxX = this.pageWidth / 2 + 5
    const clientBoxY = this.currentY - 2  // Changed from -4 to -2 to move box down
    const clientBoxWidth = this.pageWidth - this.margin - clientBoxX
    const clientBoxHeight = 28

    // Draw client box
    this.doc.setDrawColor(this.lightGray)
    this.doc.setLineWidth(0.2)
    this.doc.rect(clientBoxX, clientBoxY - 8, clientBoxWidth, clientBoxHeight)

    // Client title
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(8)
    this.doc.setTextColor(this.primaryColor)
    this.doc.text('CLIENT', clientBoxX + 3, clientBoxY - 4)

    // Client details
    let clientY = clientBoxY + 1
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(9)
    this.doc.setTextColor(this.textColor)
    this.doc.text(client.name, clientBoxX + 3, clientY)

    clientY += 4
    if (client.company) {
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(8)
      this.doc.text(client.company, clientBoxX + 3, clientY)
      clientY += 3.5
    }

    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(8)
    this.doc.text(client.address, clientBoxX + 3, clientY)

    clientY += 3.5
    this.doc.text(`${client.postalCode} ${client.city}`, clientBoxX + 3, clientY)

    if (client.phone) {
      clientY += 3.5
      this.doc.text(`Tél: ${client.phone}`, clientBoxX + 3, clientY)
    }

    this.currentY = Math.max(this.currentY + 6, clientBoxY + clientBoxHeight)
  }

  private drawItemsTable(items: QuotationItem[]) {
    this.currentY += 6

    // Table headers - removed TVA column as per business decision (individuals not subject to VAT, no per-line tax display)
    const headers = ['Description', 'Qté', 'P.U. HT', 'Rem.', 'Total HT']
    // Adjusted widths: Removed TVA column, distributed space to Description and Total
    const columnWidths = [80, 15, 24, 18, 33]
    const tableX = this.margin
    const tableWidth = this.pageWidth - 2 * this.margin

    // Draw header background
    this.doc.setFillColor(this.primaryColor)
    this.doc.rect(tableX, this.currentY, tableWidth, 7, 'F')

    // Draw header text
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(9)
    this.doc.setTextColor('#ffffff')

    let currentX = tableX
    headers.forEach((header, index) => {
      const alignment = index === headers.length - 1 ? 'right' : 'left'
      const xPos = alignment === 'right'
        ? currentX + columnWidths[index] - 2
        : currentX + 2
      this.doc.text(header, xPos, this.currentY + 4.5, { align: alignment })
      currentX += columnWidths[index]
    })

    this.currentY += 7

    // Draw items
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(8)
    this.doc.setTextColor(this.textColor)

    items.forEach((item, index) => {
      this.addNewPageIfNeeded(15)

      // Alternate row background
      if (index % 2 === 1) {
        this.doc.setFillColor('#f9fafb')
        this.doc.rect(tableX, this.currentY, tableWidth, 6, 'F')
      }

      currentX = tableX

      // Description (can be multiline)
      const descriptionLines = this.doc.splitTextToSize(item.description, columnWidths[0] - 4)
      const lineCount = descriptionLines.length

      descriptionLines.forEach((line, lineIndex) => {
        this.doc.text(line, currentX + 2, this.currentY + 4 + (lineIndex * 3.5))
      })

      currentX += columnWidths[0]

      // Quantity - centered
      this.doc.text(item.quantity.toString(), currentX + columnWidths[1] / 2, this.currentY + 4, { align: 'center' })
      currentX += columnWidths[1]

      // Unit price - right aligned
      this.doc.text(`${item.unitPrice.toFixed(2)}€`, currentX + columnWidths[2] - 2, this.currentY + 4, { align: 'right' })
      currentX += columnWidths[2]

      // Discount - centered
      if (item.discount) {
        const discountText = item.discountType === 'percent'
          ? `${item.discount}%`
          : `${item.discount.toFixed(2)}€`
        this.doc.text(discountText, currentX + columnWidths[3] / 2, this.currentY + 4, { align: 'center' })
      } else {
        this.doc.text('-', currentX + columnWidths[3] / 2, this.currentY + 4, { align: 'center' })
      }
      currentX += columnWidths[3]

      // Total - right aligned with bold (removed tax column)
      this.doc.setFont('helvetica', 'bold')
      this.doc.text(`${item.total.toFixed(2)} €`, currentX + columnWidths[4] - 2, this.currentY + 4, { align: 'right' })
      this.doc.setFont('helvetica', 'normal')

      this.currentY += Math.max(6, lineCount * 3.5 + 2)

      // Draw separator line
      this.doc.setDrawColor(this.lightGray)
      this.doc.setLineWidth(0.1)
      this.doc.line(tableX, this.currentY, this.pageWidth - this.margin, this.currentY)
      this.currentY += 0.5
    })
  }

  private drawTotals(quotation: Quotation) {
    this.currentY += 6

    const totalsX = this.pageWidth - this.margin - 60
    const labelX = totalsX - 35

    // Subtotal
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(9)
    this.doc.setTextColor(this.textColor)
    this.doc.text('Sous-total HT:', labelX, this.currentY, { align: 'right' })
    this.doc.text(`${quotation.subtotal.toFixed(2)} €`, totalsX + 50, this.currentY, { align: 'right' })

    this.currentY += 5

    // Discount if any
    if (quotation.totalDiscount > 0) {
      this.doc.text('Remise totale:', labelX, this.currentY, { align: 'right' })
      this.doc.text(`-${quotation.totalDiscount.toFixed(2)} €`, totalsX + 50, this.currentY, { align: 'right' })
      this.currentY += 5
    }

    // Shipping cost if any
    if (quotation.shippingCost && quotation.shippingCost > 0) {
      this.doc.text('Frais de livraison:', labelX, this.currentY, { align: 'right' })
      this.doc.text(`${quotation.shippingCost.toFixed(2)} €`, totalsX + 50, this.currentY, { align: 'right' })
      this.currentY += 5
    }

    // Installation cost if any
    if (quotation.installationCost && quotation.installationCost > 0) {
      this.doc.text('Frais d\'installation:', labelX, this.currentY, { align: 'right' })
      this.doc.text(`${quotation.installationCost.toFixed(2)} €`, totalsX + 50, this.currentY, { align: 'right' })
      this.currentY += 5
    }

    // Tax
    this.doc.text('TVA:', labelX, this.currentY, { align: 'right' })
    this.doc.text(`${quotation.totalTax.toFixed(2)} €`, totalsX + 50, this.currentY, { align: 'right' })

    this.currentY += 6

    // Draw total line
    this.doc.setDrawColor(this.primaryColor)
    this.doc.setLineWidth(0.4)
    this.doc.line(labelX - 15, this.currentY, totalsX + 50, this.currentY)

    this.currentY += 6

    // Total
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(11)
    this.doc.setTextColor(this.primaryColor)
    this.doc.text('TOTAL TTC:', labelX, this.currentY, { align: 'right' })
    this.doc.text(`${quotation.total.toFixed(2)} €`, totalsX + 50, this.currentY, { align: 'right' })
  }

  private drawFooter(quotation: Quotation) {
    // Notes - compact
    if (quotation.notes) {
      this.currentY += 12
      this.addNewPageIfNeeded(30)

      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(9)
      this.doc.setTextColor(this.textColor)
      this.doc.text('Notes:', this.margin, this.currentY)

      this.currentY += 4
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(8)
      const notesLines = this.doc.splitTextToSize(quotation.notes, this.pageWidth - 2 * this.margin)
      notesLines.forEach(line => {
        this.doc.text(line, this.margin, this.currentY)
        this.currentY += 3.5
      })
    }

    // Terms and conditions - compact
    if (quotation.termsAndConditions) {
      this.currentY += 8
      this.addNewPageIfNeeded(30)

      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(9)
      this.doc.setTextColor(this.textColor)
      this.doc.text('Conditions générales:', this.margin, this.currentY)

      this.currentY += 4
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(7)
      const termsLines = this.doc.splitTextToSize(quotation.termsAndConditions, this.pageWidth - 2 * this.margin)
      termsLines.forEach(line => {
        this.doc.text(line, this.margin, this.currentY)
        this.currentY += 3
      })
    }

    // Signature boxes - compact
    this.currentY = this.pageHeight - 45

    const sigBoxWidth = 65
    const sigBoxHeight = 25

    this.doc.setDrawColor(this.lightGray)
    this.doc.setLineWidth(0.2)
    this.doc.rect(this.margin, this.currentY, sigBoxWidth, sigBoxHeight)

    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(8)
    this.doc.setTextColor(this.textColor)
    this.doc.text('Signature client', this.margin + 2, this.currentY - 2)
    this.doc.text('Date:', this.margin + 2, this.currentY + sigBoxHeight + 3)

    // Company signature box
    this.doc.rect(this.pageWidth - this.margin - sigBoxWidth, this.currentY, sigBoxWidth, sigBoxHeight)
    this.doc.text('Signature & cachet', this.pageWidth - this.margin - sigBoxWidth + 2, this.currentY - 2)
    this.doc.text('Date:', this.pageWidth - this.margin - sigBoxWidth + 2, this.currentY + sigBoxHeight + 3)

    // Footer text - compact
    this.doc.setFontSize(7)
    this.doc.setTextColor(this.lightGray)
    this.doc.text(
      'Devis valable 30 jours.',
      this.pageWidth / 2,
      this.pageHeight - 8,
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

  private drawSalesOrderHeader(company: Company, salesOrder: SalesOrder) {
    // Sales Order Title
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(16)
    this.doc.setTextColor(this.primaryColor)
    this.doc.text('BON DE COMMANDE', this.margin, this.currentY)

    // Order number below title
    this.currentY += 5
    this.doc.setFontSize(11)
    this.doc.setTextColor(this.textColor)
    this.doc.text(`N° ${salesOrder.orderNumber}`, this.margin, this.currentY)

    // Cross-reference to quotation if available
    if (salesOrder.quotationNumber) {
      this.currentY += 4
      this.doc.setFontSize(8)
      this.doc.setTextColor(this.lightGray)
      this.doc.text(`Réf. Devis: ${salesOrder.quotationNumber}`, this.margin, this.currentY)
    }

    // Company info on the right (same as quotation)
    const companyBoxX = 110
    this.currentY = this.margin

    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(11)
    this.doc.setTextColor(this.textColor)
    this.doc.text(company.name, companyBoxX, this.currentY, { align: 'left' })

    this.currentY += 4
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(8)
    this.doc.setTextColor(this.lightGray)

    this.doc.text(company.address, companyBoxX, this.currentY)
    this.currentY += 3
    this.doc.text(`${company.postalCode} ${company.city}`, companyBoxX, this.currentY)
    this.currentY += 3
    this.doc.text(`Tél: ${company.phone}`, companyBoxX, this.currentY)
    this.currentY += 3
    this.doc.text(`Email: ${company.email}`, companyBoxX, this.currentY)

    if (company.siret) {
      this.currentY += 3
      this.doc.text(`SIRET: ${company.siret}`, companyBoxX, this.currentY)
    }
    if (company.tva) {
      this.currentY += 3
      this.doc.text(`TVA: ${company.tva}`, companyBoxX, this.currentY)
    }

    this.currentY = this.margin + 32
  }

  private drawInvoiceHeader(company: Company, invoice: Invoice) {
    // Invoice Title
    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(16)
    this.doc.setTextColor(this.primaryColor)
    this.doc.text('FACTURE', this.margin, this.currentY)

    // Invoice number below title
    this.currentY += 5
    this.doc.setFontSize(11)
    this.doc.setTextColor(this.textColor)
    this.doc.text(`N° ${invoice.invoiceNumber}`, this.margin, this.currentY)

    // Cross-references
    if (invoice.orderNumber || invoice.quotationNumber) {
      this.currentY += 4
      this.doc.setFontSize(8)
      this.doc.setTextColor(this.lightGray)

      if (invoice.orderNumber) {
        this.doc.text(`Réf. Commande: ${invoice.orderNumber}`, this.margin, this.currentY)
        this.currentY += 3
      }
      if (invoice.quotationNumber) {
        this.doc.text(`Réf. Devis: ${invoice.quotationNumber}`, this.margin, this.currentY)
      }
    }

    // Company info on the right (same as quotation)
    const companyBoxX = 110
    this.currentY = this.margin

    this.doc.setFont('helvetica', 'bold')
    this.doc.setFontSize(11)
    this.doc.setTextColor(this.textColor)
    this.doc.text(company.name, companyBoxX, this.currentY, { align: 'left' })

    this.currentY += 4
    this.doc.setFont('helvetica', 'normal')
    this.doc.setFontSize(8)
    this.doc.setTextColor(this.lightGray)

    this.doc.text(company.address, companyBoxX, this.currentY)
    this.currentY += 3
    this.doc.text(`${company.postalCode} ${company.city}`, companyBoxX, this.currentY)
    this.currentY += 3
    this.doc.text(`Tél: ${company.phone}`, companyBoxX, this.currentY)
    this.currentY += 3
    this.doc.text(`Email: ${company.email}`, companyBoxX, this.currentY)

    if (company.siret) {
      this.currentY += 3
      this.doc.text(`SIRET: ${company.siret}`, companyBoxX, this.currentY)
    }
    if (company.tva) {
      this.currentY += 3
      this.doc.text(`TVA: ${company.tva}`, companyBoxX, this.currentY)
    }

    this.currentY = this.margin + 35
  }

  public generateSalesOrderPDF(
    company: Company,
    salesOrder: SalesOrder,
    download: boolean = true,
    filename?: string
  ): jsPDF {
    this.resetDoc()

    // Convert SalesOrder to Quotation format for reusing existing methods
    const quotationFormat = {
      ...salesOrder,
      number: salesOrder.orderNumber,
      date: salesOrder.orderDate,
      validUntil: salesOrder.expectedDeliveryDate || salesOrder.orderDate,
      status: 'sent' as const
    }

    // Draw all sections with sales order header
    this.drawSalesOrderHeader(company, salesOrder)
    this.drawClientInfo(salesOrder.client, quotationFormat, 'Date estimée de livraison:')
    this.drawItemsTable(salesOrder.items)
    this.drawTotals(quotationFormat)

    // Down payment section for sales order
    if (salesOrder.downPaymentAmount && salesOrder.downPaymentAmount > 0) {
      this.currentY += 8
      const totalsX = this.pageWidth - this.margin - 60
      const labelX = totalsX - 35

      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(9)
      this.doc.setTextColor('#16a34a') // Green-600

      this.doc.text('Acompte versé:', labelX, this.currentY, { align: 'right' })
      this.doc.text(`-${salesOrder.downPaymentAmount.toFixed(2)} €`, totalsX + 50, this.currentY, { align: 'right' })

      this.currentY += 5

      const remainingBalance = salesOrder.total - salesOrder.downPaymentAmount
      this.doc.setTextColor(this.textColor)
      this.doc.text('Solde restant:', labelX, this.currentY, { align: 'right' })
      this.doc.text(`${remainingBalance.toFixed(2)} €`, totalsX + 50, this.currentY, { align: 'right' })

      // Add payment details if available
      if (salesOrder.downPaymentMethod || salesOrder.downPaymentDate) {
        this.currentY += 8
        this.doc.setFont('helvetica', 'normal')
        this.doc.setFontSize(8)
        this.doc.setTextColor(this.textColor)

        if (salesOrder.downPaymentMethod) {
          const methodLabel = salesOrder.downPaymentMethod === 'especes' ? 'Espèces' :
                             salesOrder.downPaymentMethod === 'carte' ? 'Carte bancaire' :
                             salesOrder.downPaymentMethod === 'virement' ? 'Virement' :
                             salesOrder.downPaymentMethod === 'cheque' ? 'Chèque' :
                             salesOrder.downPaymentMethod
          this.doc.text(`Mode de paiement: ${methodLabel}`, labelX - 35, this.currentY, { align: 'left' })
          this.currentY += 4
        }

        if (salesOrder.downPaymentDate) {
          const dateStr = salesOrder.downPaymentDate.toLocaleDateString('fr-FR')
          this.doc.text(`Date de paiement: ${dateStr}`, labelX - 35, this.currentY, { align: 'left' })
        }
      }
    }

    // Custom footer for sales order
    this.addNewPageIfNeeded(40)
    this.currentY += 10

    if (salesOrder.notes) {
      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(9)
      this.doc.setTextColor(this.textColor)
      this.doc.text('Notes:', this.margin, this.currentY)

      this.currentY += 4
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(8)
      const notesLines = this.doc.splitTextToSize(salesOrder.notes, this.pageWidth - 2 * this.margin)
      notesLines.forEach((line) => {
        this.doc.text(line, this.margin, this.currentY)
        this.currentY += 4
      })
    }

    // Terms and conditions for sales order
    if (salesOrder.termsAndConditions) {
      this.currentY += 8
      this.addNewPageIfNeeded(30)

      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(9)
      this.doc.setTextColor(this.textColor)
      this.doc.text('Conditions générales de vente:', this.margin, this.currentY)

      this.currentY += 4
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(7)
      const termsLines = this.doc.splitTextToSize(salesOrder.termsAndConditions, this.pageWidth - 2 * this.margin)
      termsLines.forEach((line) => {
        this.doc.text(line, this.margin, this.currentY)
        this.currentY += 3
      })
    }

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
      const defaultFilename = `Commande_${salesOrder.orderNumber}_${salesOrder.client.name.replace(/\s+/g, '_')}.pdf`
      this.doc.save(filename || defaultFilename)
    }

    return this.doc
  }

  public generateInvoicePDF(
    company: Company,
    invoice: Invoice,
    download: boolean = true,
    filename?: string
  ): jsPDF {
    this.resetDoc()

    // Convert Invoice to Quotation format for reusing existing methods
    const quotationFormat = {
      ...invoice,
      number: invoice.invoiceNumber,
      date: invoice.invoiceDate,
      validUntil: invoice.dueDate || invoice.invoiceDate,
      status: 'sent' as const
    }

    // Draw all sections with invoice header
    this.drawInvoiceHeader(company, invoice)
    this.drawClientInfo(invoice.client, quotationFormat, 'Date d\'échéance:')
    this.drawItemsTable(invoice.items)
    this.drawTotals(quotationFormat)

    // Payment information for invoice
    // Only show payment breakdown if invoice is NOT fully paid
    if (invoice.status !== 'payee') {
      if (invoice.downPaymentAmount && invoice.downPaymentAmount > 0) {
        this.currentY += 8
        const totalsX = this.pageWidth - this.margin - 60
        const labelX = totalsX - 35

        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(9)
        this.doc.setTextColor('#16a34a') // Green-600

        this.doc.text('Acompte versé:', labelX, this.currentY, { align: 'right' })
        this.doc.text(`-${invoice.downPaymentAmount.toFixed(2)} €`, totalsX + 50, this.currentY, { align: 'right' })

        this.currentY += 5

        // Calculate remaining balance
        const remainingBalance = invoice.total - invoice.downPaymentAmount
        this.doc.setTextColor(this.textColor)
        this.doc.text('Solde dû:', labelX, this.currentY, { align: 'right' })
        this.doc.text(`${remainingBalance.toFixed(2)} €`, totalsX + 50, this.currentY, { align: 'right' })

        // Add payment details if available
        if (invoice.downPaymentMethod || invoice.downPaymentDate) {
          this.currentY += 8
          this.doc.setFont('helvetica', 'normal')
          this.doc.setFontSize(8)
          this.doc.setTextColor(this.textColor)

          if (invoice.downPaymentMethod) {
            const methodLabel = invoice.downPaymentMethod === 'especes' ? 'Espèces' :
                               invoice.downPaymentMethod === 'carte' ? 'Carte bancaire' :
                               invoice.downPaymentMethod === 'virement' ? 'Virement' :
                               invoice.downPaymentMethod === 'cheque' ? 'Chèque' :
                               invoice.downPaymentMethod
            this.doc.text(`Acompte payé par: ${methodLabel}`, labelX - 35, this.currentY, { align: 'left' })
            this.currentY += 4
          }

          if (invoice.downPaymentDate) {
            const dateStr = invoice.downPaymentDate.toLocaleDateString('fr-FR')
            this.doc.text(`Date de l'acompte: ${dateStr}`, labelX - 35, this.currentY, { align: 'left' })
          }
        }
      } else if (invoice.amountDue !== undefined && invoice.amountDue > 0) {
        // Legacy: show remaining amount if no down payment but still unpaid
        this.currentY += 8
        const totalsX = this.pageWidth - this.margin - 60
        const labelX = totalsX - 35

        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(9)
        this.doc.setTextColor(this.primaryColor)

        this.doc.text('Reste à payer:', labelX, this.currentY, { align: 'right' })
        this.doc.text(`${invoice.amountDue.toFixed(2)} €`, totalsX + 50, this.currentY, { align: 'right' })
      }
    } else {
      // Invoice is fully paid - show PAID stamp
      this.currentY += 10
      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(14)
      this.doc.setTextColor('#16a34a') // Green
      this.doc.text('✓ PAYÉE', this.pageWidth / 2, this.currentY, { align: 'center' })

      if (invoice.amountPaid && invoice.amountPaid > 0) {
        this.currentY += 6
        this.doc.setFontSize(9)
        this.doc.setTextColor(this.textColor)
        this.doc.text(`Solde payé le ${invoice.amountPaid ? new Date().toLocaleDateString('fr-FR') : ''}`, this.pageWidth / 2, this.currentY, { align: 'center' })
      }
    }

    // Custom footer for invoice
    this.addNewPageIfNeeded(40)
    this.currentY += 10

    if (invoice.paymentTerms) {
      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(9)
      this.doc.setTextColor(this.textColor)
      this.doc.text('Conditions de paiement:', this.margin, this.currentY)

      this.currentY += 4
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(8)
      this.doc.text(this.formatPaymentTerms(invoice.paymentTerms), this.margin, this.currentY)
      this.currentY += 6
    }

    if (invoice.notes) {
      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(9)
      this.doc.setTextColor(this.textColor)
      this.doc.text('Notes:', this.margin, this.currentY)

      this.currentY += 4
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(8)
      const notesLines = this.doc.splitTextToSize(invoice.notes, this.pageWidth - 2 * this.margin)
      notesLines.forEach((line) => {
        this.doc.text(line, this.margin, this.currentY)
        this.currentY += 4
      })
    }

    // Terms and conditions for invoice
    if (invoice.termsAndConditions) {
      this.currentY += 8
      this.addNewPageIfNeeded(30)

      this.doc.setFont('helvetica', 'bold')
      this.doc.setFontSize(9)
      this.doc.setTextColor(this.textColor)
      this.doc.text('Conditions générales de vente:', this.margin, this.currentY)

      this.currentY += 4
      this.doc.setFont('helvetica', 'normal')
      this.doc.setFontSize(7)
      const termsLines = this.doc.splitTextToSize(invoice.termsAndConditions, this.pageWidth - 2 * this.margin)
      termsLines.forEach((line) => {
        this.doc.text(line, this.margin, this.currentY)
        this.currentY += 3
      })
    }

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
      const defaultFilename = `Facture_${invoice.invoiceNumber}_${invoice.client.name.replace(/\s+/g, '_')}.pdf`
      this.doc.save(filename || defaultFilename)
    }

    return this.doc
  }
}

// Export a singleton instance
export const pdfGenerator = new PDFGenerator()

// Helper function to format payment terms
export const formatPaymentTerms = (terms: string | undefined): string => {
  if (!terms) return ''

  // If it's just a number, format it as "Paiement sous X jours"
  if (/^\d+$/.test(terms.trim())) {
    return `Paiement sous ${terms} jours`
  }

  // Otherwise return as-is
  return terms
}

// Helper functions for quick PDF generation
export const generateQuotationPDF = (
  company: Company,
  quotation: Quotation,
  download: boolean = true,
  filename?: string
) => {
  const generator = new PDFGenerator()
  return generator.generateQuotationPDF(company, quotation, download, filename)
}

export const generateSalesOrderPDF = (
  company: Company,
  salesOrder: SalesOrder,
  download: boolean = true,
  filename?: string
) => {
  const generator = new PDFGenerator()
  return generator.generateSalesOrderPDF(company, salesOrder, download, filename)
}

export const generateInvoicePDF = (
  company: Company,
  invoice: Invoice,
  download: boolean = true,
  filename?: string
) => {
  const generator = new PDFGenerator()
  return generator.generateInvoicePDF(company, invoice, download, filename)
}

// Export types for external use
export type { Company, Client, QuotationItem, Quotation, SalesOrder, Invoice }