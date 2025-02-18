 

const mongoose = require("mongoose");
const { Schema, model } = mongoose;

 
const customerSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  address: { type: String, required: true },
  contactNumber: { type: String, required: true },
  subcustomers: [{ type: Schema.Types.ObjectId, ref: 'Subcustomer' }]  
});

 
const subcustomerSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  contactNumber: { type: String, required: true },
  address: { type: String, required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true } 
   
}, { timestamps: true });

 
const subcustomerPurchasedProductsSchema= new mongoose.Schema({
  subcustomerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subcustomer' },
  products: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      quantity: { type: Number, required: true },
      variants: [
        {
          serialNumber: { type: String, required: true },
          sold: { type: Boolean, required: true },
        }
      ]
    }
  ]
});



 
const subcustomerOrdersSchema = new Schema({
  subcustomerId: { type: Schema.Types.ObjectId, ref: 'Subcustomer', required: true },
  orderDate: { type: Date, required: true },
  orderDetails: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    serialArray: { type: [String], required: true }, 
    deliveredQuantity: { type: Number, default: 0 },
    pendingQuantity: { type: Number, default: 0 }
  }],
  totalPrice: { type: Number, required: true }
}, { timestamps: true });
 
const productSchema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true }
});

 
const orderSchema = new Schema({
  customerId: { type: mongoose.Types.ObjectId, ref: "Customers" },
  orderDetail: [
    {
      productId: { type: mongoose.Types.ObjectId, ref: "Products" },
      totalQuantity: { type: Number, required: true },
      serialArray: [
        {
          serialNumber: { type: Number, required: true },
          status: { type: String, enum: ['available', 'sold'], default: 'available' },
        }
      ],  
      deliveredQuantity: { type: Number, default: 0 },
      pendingQuantity: { type: Number, required: true },
    },
  ],
  totalPrice: { type: Number, required: true },
  orderDate: { type: Date, default: Date.now },
});

 
const Subcustomer = mongoose.model('Subcustomer', subcustomerSchema);
const SubcustomerPurchasedProducts = mongoose.model('SubcustomerPurchasedProducts', subcustomerPurchasedProductsSchema);
const SubcustomerOrders = mongoose.model('SubcustomerOrders', subcustomerOrdersSchema);
const ProductModel = mongoose.model('Product', productSchema);
const OrderModel = mongoose.model('Order', orderSchema);
const CustomerModel = mongoose.model('Customer', customerSchema);

 
module.exports = {
  CustomerModel,
  ProductModel,
  OrderModel,
  Subcustomer,
  SubcustomerPurchasedProducts,
  SubcustomerOrders
};
