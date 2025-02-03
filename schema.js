const mongoose = require("mongoose");
const { Schema, model, Types } = mongoose;

// Customer schema
const customerSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  address: { type: String, required: true },
  contactNumber: { type: String, required: true },
});

// Product schema
const productSchema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
});

// Product variant schema
const productVariantSchema = new Schema({
  serialNumber: { type: String, required: true, unique: true },
  productId: { type: mongoose.Types.ObjectId, ref: "Products", required: true },
  color: String,
  size: String,
  price: { type: String, required: true },
});

// Order schema
const orderSchema = new Schema({
  customerId: { type: mongoose.Types.ObjectId, ref: "Customers" },
  orderDetail: [
    {
      productId: { type: mongoose.Types.ObjectId, ref: "Products" },
      totalQuantity: { type: Number, required: true },
      serialArray: { type: [Number], default: [] },  
      deliverdQuantity: { type: Number, default: 0 },
      pendingQuantity: { type: Number, required: true },
    },
  ],
  totalPrice: { type: Number, required: true },
  orderDate: { type: Date, default: Date.now },
});

// Invoice schema
const invoiceSchema = new Schema({
  invoiceId: { type: mongoose.Types.ObjectId, auto: true },
  orderId: { type: mongoose.Types.ObjectId, ref: "Orders", required: true },
  customerId: { type: mongoose.Types.ObjectId, ref: "Customers", required: true },
  products: [
    {
      productId: { type: mongoose.Types.ObjectId, ref: "Products", required: true },
      quantity: { type: String, required: true },
      price: { type: Number, required: true },
      total: { type: Number, required: true },
    },
  ],
  invoiceDate: { type: Date, default: Date.now },
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ["pending", "paid"], default: "pending" },
});

// Exporting all models
module.exports = {
  CustomerModel: model("Customers", customerSchema),
  ProductModel: model("Products", productSchema),
  ProductVariantModel: model("ProductVariant", productVariantSchema),
  OrderModel: model("Orders", orderSchema),
  InvoiceModel: model("Invoice", invoiceSchema),
};
