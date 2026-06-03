const { Invoice, Order, OrderItem, Restaurant, Customer } = require('../../models');
const { generateInvoicePDF } = require('../../utils/pdfGenerator');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs').promises;

class InvoiceService {
  /**
   * Génère un numéro de facture unique
   */
  async generateInvoiceNumber(restaurantId) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `INV-${year}${month}-`;

    // Count all invoices globally to avoid unique constraint violations
    const totalCount = await Invoice.count();

    return `${prefix}${String(totalCount + 1).padStart(5, '0')}`;
  }

  async getAll(restaurantId, filters = {}) {
    const where = { restaurant_id: restaurantId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.startDate && filters.endDate) {
      where.issued_at = {
        [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
      };
    }

    const invoices = await Invoice.findAll({
      where,
      include: [{
        model: Order,
        as: 'order',
        attributes: ['id', 'order_number', 'type']
      }],
      order: [['issued_at', 'DESC']]
    });

    return invoices;
  }

  async getById(restaurantId, invoiceId) {
    const invoice = await Invoice.findOne({
      where: {
        id: invoiceId,
        restaurant_id: restaurantId
      },
      include: [{
        model: Order,
        as: 'order',
        include: [{
          model: OrderItem,
          as: 'items'
        }]
      }]
    });

    if (!invoice) {
      throw new Error('Facture non trouvée');
    }

    return invoice;
  }

  /**
   * Génération automatique de facture après paiement
   */
  async generate(restaurantId, orderId, transaction = null) {
    // Vérifier si une facture existe déjà
    const existingInvoice = await Invoice.findOne({
      where: {
        order_id: orderId,
        restaurant_id: restaurantId
      },
      transaction
    });

    if (existingInvoice) {
      return existingInvoice;
    }

    // Récupérer les données de la commande
    const order = await Order.findOne({
      where: {
        id: orderId,
        restaurant_id: restaurantId
      },
      include: [
        {
          model: OrderItem,
          as: 'items'
        },
        {
          model: Customer,
          as: 'customer'
        },
        {
          model: Restaurant,
          as: 'restaurant'
        }
      ],
      transaction
    });

    if (!order) {
      throw new Error('Commande non trouvée');
    }

    // Générer le numéro de facture
    const invoiceNumber = await this.generateInvoiceNumber(restaurantId);

    // Créer la facture
    const invoice = await Invoice.create({
      restaurant_id: restaurantId,
      order_id: orderId,
      invoice_number: invoiceNumber,
      customer_name: order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : 'Client',
      customer_phone: order.customer?.phone,
      subtotal: order.subtotal,
      tax_amount: order.tax_amount,
      discount_amount: order.discount_amount,
      total_amount: order.total_amount,
      status: 'issued',
      issued_at: new Date()
    }, { transaction });

    // Générer le PDF (hors transaction pour éviter rollback si PDF échoue)
    if (!transaction) {
      try {
        const pdfPath = await generateInvoicePDF(invoice, order);
        await invoice.update({ pdf_url: pdfPath });
      } catch (error) {
        console.error('Erreur génération PDF:', error);
        // Ne pas échouer la création si le PDF échoue
      }
    }

    return invoice;
  }

  /**
   * Récupérer le chemin du PDF
   */
  async getPDFPath(restaurantId, invoiceId) {
    const invoice = await Invoice.findOne({
      where: {
        id: invoiceId,
        restaurant_id: restaurantId
      }
    });

    if (!invoice) {
      throw new Error('Facture non trouvée');
    }

    if (!invoice.pdf_url) {
      throw new Error('PDF non disponible');
    }

    const pdfPath = path.join(process.cwd(), invoice.pdf_url);
    
    try {
      await fs.access(pdfPath);
      return pdfPath;
    } catch {
      throw new Error('Fichier PDF non trouvé');
    }
  }

  /**
   * Régénérer le PDF
   */
  async regeneratePDF(restaurantId, invoiceId) {
    const invoice = await Invoice.findOne({
      where: {
        id: invoiceId,
        restaurant_id: restaurantId
      },
      include: [{
        model: Order,
        as: 'order',
        include: [{
          model: OrderItem,
          as: 'items'
        }]
      }]
    });

    if (!invoice) {
      throw new Error('Facture non trouvée');
    }

    const pdfPath = await generateInvoicePDF(invoice, invoice.order);
    await invoice.update({ pdf_url: pdfPath });

    return invoice;
  }
}

module.exports = new InvoiceService();
