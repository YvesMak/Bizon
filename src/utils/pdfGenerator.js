const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Générateur de factures PDF
 */
class PDFGenerator {
  /**
   * Génère une facture PDF pour une commande
   */
  async generateInvoicePDF(invoice, order) {
    // Créer le dossier de stockage si inexistant
    const storageDir = path.join(process.cwd(), 'storage', 'invoices');
    await this.ensureDirectoryExists(storageDir);

    // Chemin du fichier PDF
    const filename = `invoice_${invoice.invoice_number}.pdf`;
    const filepath = path.join(storageDir, filename);

    return new Promise((resolve, reject) => {
      try {
        // Créer le document PDF
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50
        });

        // Pipe vers le fichier
        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        // Header
        this.generateHeader(doc, order.restaurant, invoice);
        
        // Informations client
        this.generateCustomerInfo(doc, invoice);
        
        // Table des produits
        this.generateItemsTable(doc, order.items);
        
        // Totaux
        this.generateTotals(doc, invoice);
        
        // Footer
        this.generateFooter(doc);

        // Finaliser le PDF
        doc.end();

        stream.on('finish', () => {
          resolve(`storage/invoices/${filename}`);
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  generateHeader(doc, restaurant, invoice) {
    doc
      .fontSize(20)
      .text(restaurant.name, 50, 50)
      .fontSize(10)
      .text(restaurant.address || '', 50, 75)
      .text(restaurant.phone || '', 50, 90)
      .text(restaurant.email || '', 50, 105);

    doc
      .fontSize(20)
      .text('FACTURE', 400, 50, { align: 'right' })
      .fontSize(10)
      .text(`N° ${invoice.invoice_number}`, 400, 75, { align: 'right' })
      .text(`Date: ${this.formatDate(invoice.issued_at)}`, 400, 90, { align: 'right' });

    doc.moveDown(3);
  }

  generateCustomerInfo(doc, invoice) {
    const customerY = 170;
    
    doc
      .fontSize(12)
      .text('Facturé à:', 50, customerY)
      .fontSize(10)
      .text(invoice.customer_name || 'Client', 50, customerY + 20)
      .text(invoice.customer_phone || '', 50, customerY + 35);

    doc.moveDown(3);
  }

  generateItemsTable(doc, items) {
    const tableTop = 280;
    const itemCodeX = 50;
    const descriptionX = 150;
    const quantityX = 350;
    const priceX = 420;
    const amountX = 490;

    // Header du tableau
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Article', itemCodeX, tableTop)
      .text('Description', descriptionX, tableTop)
      .text('Qté', quantityX, tableTop)
      .text('Prix unit.', priceX, tableTop)
      .text('Total', amountX, tableTop);

    // Ligne de séparation
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, tableTop + 20)
      .lineTo(550, tableTop + 20)
      .stroke();

    // Items
    let y = tableTop + 30;
    doc.font('Helvetica');

    items.forEach((item, index) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      doc
        .fontSize(9)
        .text(index + 1, itemCodeX, y)
        .text(item.product_name, descriptionX, y, { width: 180 })
        .text(item.quantity, quantityX, y)
        .text(this.formatCurrency(item.unit_price), priceX, y)
        .text(this.formatCurrency(item.subtotal), amountX, y);

      y += 25;
    });

    return y;
  }

  generateTotals(doc, invoice) {
    const totalY = 600;
    const labelX = 400;
    const amountX = 490;

    doc
      .fontSize(10)
      .text('Sous-total:', labelX, totalY)
      .text(this.formatCurrency(invoice.subtotal), amountX, totalY);

    if (parseFloat(invoice.tax_amount) > 0) {
      doc
        .text('TVA (18%):', labelX, totalY + 20)
        .text(this.formatCurrency(invoice.tax_amount), amountX, totalY + 20);
    }

    if (parseFloat(invoice.discount_amount) > 0) {
      doc
        .text('Remise:', labelX, totalY + 40)
        .text(`-${this.formatCurrency(invoice.discount_amount)}`, amountX, totalY + 40);
    }

    // Ligne de séparation
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(400, totalY + 55)
      .lineTo(550, totalY + 55)
      .stroke();

    // Total
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('TOTAL:', labelX, totalY + 65)
      .text(this.formatCurrency(invoice.total_amount), amountX, totalY + 65);
  }

  generateFooter(doc) {
    doc
      .fontSize(8)
      .text(
        'Merci pour votre confiance !',
        50,
        750,
        { align: 'center', width: 500 }
      );
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount) + ' FCFA';
  }

  formatDate(date) {
    return new Date(date).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  async ensureDirectoryExists(directory) {
    try {
      await fs.promises.access(directory);
    } catch {
      await fs.promises.mkdir(directory, { recursive: true });
    }
  }
}

const pdfGenerator = new PDFGenerator();

module.exports = {
  generateInvoicePDF: (invoice, order) => pdfGenerator.generateInvoicePDF(invoice, order)
};
