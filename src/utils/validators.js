const Joi = require('joi');

/**
 * Schémas de validation Joi
 */

// Auth
const registerSchema = Joi.object({
  restaurantName: Joi.string().required().min(2).max(100),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6),
  firstName: Joi.string().required().min(2),
  lastName: Joi.string().required().min(2),
  phone: Joi.string().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Product
const productSchema = Joi.object({
  category_id: Joi.string().uuid().required(),
  name: Joi.string().required().min(2).max(100),
  description: Joi.string().optional().allow(''),
  price: Joi.number().positive().required(),
  cost_price: Joi.number().positive().optional(),
  stock_quantity: Joi.number().integer().min(0).optional(),
  low_stock_threshold: Joi.number().integer().min(0).optional(),
  track_stock: Joi.boolean().optional(),
  image_url: Joi.string().uri().optional().allow(''),
  is_available: Joi.boolean().optional()
});

// Order
const orderItemSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).required(),
  notes: Joi.string().optional().allow('')
});

const orderSchema = Joi.object({
  customer_id: Joi.string().uuid().optional(),
  type: Joi.string().valid('dine_in', 'takeaway').required(),
  table_number: Joi.string().optional().allow(''),
  items: Joi.array().items(orderItemSchema).min(1).required(),
  notes: Joi.string().optional().allow('')
});

// Payment
const paymentSchema = Joi.object({
  order_id: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  method: Joi.string().valid('mobile_money', 'cash', 'card').required(),
  transaction_code: Joi.string().optional().allow(''),
  phone_number: Joi.string().optional(),
  provider: Joi.string().optional().allow('')
});

/**
 * Middleware de validation
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation échouée',
        details: errors
      });
    }

    req.body = value;
    next();
  };
};

module.exports = {
  schemas: {
    register: registerSchema,
    login: loginSchema,
    product: productSchema,
    order: orderSchema,
    payment: paymentSchema
  },
  validate
};
