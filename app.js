const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');

const {
    CustomerModel,
    ProductModel,
    OrderModel,
    InvoiceModel,
    Subcustomer,
    SubcustomerPurchasedProducts,
    SubcustomerOrders,
    SoldSerial,
} = require('./schema');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));
require('dotenv').config();

const dburl = process.env.Mongo_Url;
async function main() {
    await mongoose.connect(dburl);
}
main().then(() => { console.log('MongoDB connected'); });

app.get("/index", (req, res) => {
    res.render("index.ejs");
});
//reamin this route fixed in app.js 
app.get("/", async (req, res) => {
    if (req.session.userId) {
        console.log("Dashboard user present ->", req.session.userId);

        try {
            const orders = await OrderModel.find({ customerId: req.session.userId });

            const products = await Promise.all(
                orders.map(async (order) => {
                    const productDetails = await ProductModel.findById(order.orderDetail[0].productId);
                    return { orderId: order._id, productName: productDetails.name };
                })
            );

            const ordersWithProductNames = orders.map((order, index) => ({
                ...order.toObject(),
                productName: products[index].productName
            }));

            console.log("Orders with product names ->", ordersWithProductNames);

            res.render("dashboard.ejs", { orders: ordersWithProductNames });

        } catch (error) {
            console.error("Error fetching orders:", error);
            res.status(500).send("An error occurred while fetching orders.");
        }
    } else {
        res.redirect("/login");
    }
});

app.get("/login", (req, res) => {
    res.render("login.ejs");
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    const user = await CustomerModel.findOne({ email: email });
    if (user) {
        req.session.userId = user._id;
        res.redirect("/");
    } else {
        res.send("Invalid email or password.");
    }
});

app.get('/customer', (req, res) => {
    res.render('customer.ejs');
});
//customer(vendor) profile
app.get("/profile", async (req, res) => {
    try {
        const userData = await CustomerModel.findById(req.session.userId);

        if (userData) {
            console.log("Profile Info", userData);
            res.render("user.ejs", { user: userData });
        } else {
            res.send("User not found.");
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
        res.status(500).send("An error occurred while fetching the user profile.");
    }
});
//cutomer(vendor)login
app.post('/add-customer', async (req, res) => {
    try {
        const { name, email, password, address, contactNumber } = req.body;

        const newCustomer = new CustomerModel({
            name,
            email,
            password,
            address,
            contactNumber,
        });

        await newCustomer.save();

        res.send('Customer added successfully!');
    } catch (err) {
        console.error('Error adding customer:', err);
        res.status(500).send('Error occurred while adding customer.');
    }
});

const generateUniqueId = require('generate-unique-id');

//company i want this route fixed in app.js

app.post('/putOrder', async (req, res) => {
    const { customerId, productId, totalQuantity, deliveredQuantity, pendingQuantity, totalPrice, orderDate } = req.body;

    if (!customerId || !productId || !totalQuantity || !deliveredQuantity || !pendingQuantity || !totalPrice || !orderDate) {
        return res.status(400).send("Missing required fields");
    }

    const productObjectId = new mongoose.Types.ObjectId(productId);

    try {

        const product = await ProductModel.findById(productObjectId);
        if (!product) {
            return res.status(404).send("Product not found");
        }

        const generateSerialNumbers = (quantity) => {
            const serialNumbers = [];
            for (let i = 0; i < quantity; i++) {
                const serial = generateUniqueId({
                    length: 10,
                    useLetters: false,
                });
                serialNumbers.push({
                    serialNumber: serial,
                    status: 'available',  
                });
            }
            return serialNumbers;
        };

        const serialNumbers = generateSerialNumbers(deliveredQuantity);

        const newOrder = new OrderModel({
            customerId: customerId,
            orderDetail: [
                {
                    productId: product._id,
                    totalQuantity: totalQuantity,
                    serialArray: serialNumbers,  
                    deliveredQuantity: deliveredQuantity,
                    pendingQuantity: pendingQuantity,
                },
            ],
            totalPrice: totalPrice,
            orderDate: new Date(orderDate),  
        });

        const savedOrder = await newOrder.save();
        res.status(201).send({
            message: "Order created successfully",
            orderId: savedOrder._id,
        });
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).send("An error occurred while creating the order.");
    }
});

//cutomer(vendor)orders
app.get('/order/:id', async (req, res) => {
    const orderId = req.params.id;

    try {
        const order = await OrderModel.findById(orderId);

        if (!order) {
            return res.status(404).send("Order not found");
        }

        const serialArray = order.orderDetail.map(detail => {
            return detail.serialArray
                .filter(serialObject => serialObject.status !== 'sold')  
                .map(serialObject => serialObject.serialNumber);         
        });

        res.render('order.ejs', {
            order: order,
            serialArray: serialArray
        });
    } catch (err) {
        return res.status(500).send("Internal Server Error");
    }
});
//add subcutomer
const { ObjectId } = mongoose.Types;
app.post("/add-subcustomer", async (req, res) => {
    console.log("customer (Vendorid) id- > ", req.session.userId, "Request Body: ", req.body);

    if (!req.session.userId) {
        return res.status(401).send("You must be logged in to allocate a subcustomer.");
    }

    const { selectedQuantity, selectedSerials, name, email, contactNumber, address, productId, orderDate } = req.body;

    if (!selectedQuantity || !selectedSerials || !name || !email || !contactNumber || !address || !productId || !orderDate) {
        return res.status(400).send("Missing required fields in the request.");
    }

    try {

        const customer = await CustomerModel.findById(req.session.userId);
        if (!customer) {
            return res.status(404).send("Customer not found.");
        }

        const order = await OrderModel.findOne({ 
            customerId: req.session.userId, 
            'orderDetail.productId': productId 
        });

        if (!order) {
            return res.status(404).send("Order not found for the specified product.");
        }

        const orderDetail = order.orderDetail.find(detail => detail.productId.toString() === productId);

        if (!orderDetail) {
            return res.status(404).send("Product not found in the order.");
        }

        const product = await ProductModel.findById(productId);
        if (!product) {
            return res.status(404).send("Product not found.");
        }

        const availableSerials = orderDetail.serialArray.filter(serial => serial.status === 'available');

        if (availableSerials.length === 0) {
            return res.status(404).send("No available serial numbers found for this product.");
        }

        const selectedSerialsArray = JSON.parse(selectedSerials);

        const unavailableSerials = selectedSerialsArray.filter(serial => 
            !availableSerials.some(availableSerial => availableSerial.serialNumber === serial)
        );

        if (unavailableSerials.length > 0) {
            return res.status(400).send(`The following serial numbers are not available: ${unavailableSerials.join(', ')}`);
        }

        await OrderModel.updateOne(
            { 
                _id: order._id, 
                'orderDetail.productId': productId, 
                'orderDetail.serialArray.serialNumber': { $in: selectedSerialsArray } 
            },
            { 
                $set: { 
                    'orderDetail.$.serialArray.$[elem].status': 'sold' 
                } 
            },
            { 
                arrayFilters: [{ 'elem.serialNumber': { $in: selectedSerialsArray } }] 
            }
        );

        let subcustomer = await Subcustomer.findOne({ email });

        if (!subcustomer) {

            subcustomer = new Subcustomer({
                name,
                email,
                contactNumber,
                address,
                customerId: customer._id
            });
            await subcustomer.save();
        }

        const purchasedProduct = {
            subcustomerId: subcustomer._id,
            products: [
                {
                    productId,
                    quantity: selectedQuantity,
                    variants: selectedSerialsArray.map(serial => ({
                        serialNumber: serial,
                        sold: true
                    }))
                }
            ]
        };

        const newSubcustomerPurchasedProduct = new SubcustomerPurchasedProducts(purchasedProduct);
        await newSubcustomerPurchasedProduct.save();

        const subcustomerOrder = new SubcustomerOrders({
            subcustomerId: subcustomer._id,
            orderDate: new Date(orderDate),
            orderDetails: [{
                productId,
                quantity: selectedQuantity,
                serialArray: selectedSerialsArray,
                deliveredQuantity: selectedQuantity,
                pendingQuantity: 0
            }],
            totalPrice: product.price * selectedQuantity 
        });

        await subcustomerOrder.save();

        res.status(200).send("Subcustomer allocated successfully and order updated.");
    } catch (error) {
        console.error("Error adding subcustomer:", error);
        res.status(500).send("An error occurred while adding the subcustomer.");
    }
});
//subcutomerss
app.get("/customers", async (req, res) => {

    if (!req.session.userId) {
        return res.redirect("/login"); 
    }

    try {

        const subCustomers = await Subcustomer.find({ customerId: req.session.userId });

        if (subCustomers.length === 0) {
            return res.render("subCustomer.ejs", { message: "No sub-customers found." });
        }

        const subCustomerDetails = await Promise.all(subCustomers.map(async (subCustomer) => {
            const orders = await SubcustomerOrders.find({ subcustomerId: subCustomer._id });

            const ordersWithDetails = await Promise.all(
                orders.map(async (order) => {
                    const productDetails = await ProductModel.findById(order.orderDetails[0].productId);
                    return {
                        productName: productDetails.name,
                        quantity: order.orderDetails[0].quantity,
                        orderDate: order.orderDate,
                    };
                })
            );

            return {
                _id: subCustomer._id,
                name: subCustomer.name,
                email: subCustomer.email,  
                contactNumber: subCustomer.contactNumber,  
                address: subCustomer.address,
                orders: ordersWithDetails,
            };
        }));

        console.log(subCustomerDetails); 

        res.render("subCustomer.ejs", { subCustomerDetails });

    } catch (error) {
        console.error("Error fetching sub-customers and orders:", error);
        res.status(500).send("An error occurred while fetching sub-customers and orders.");
    }
});
//subcutomer products
app.get("/customer/:id", async (req, res) => {
    const subCustomerId = req.params.id;

    if (!req.session.userId) {
        return res.redirect("/login"); 
    }

    try {

        const subCustomer = await Subcustomer.findOne({ _id: subCustomerId, customerId: req.session.userId });

        if (!subCustomer) {
            return res.status(404).send("Sub-customer not found.");
        }

        const orders = await SubcustomerOrders.find({ subcustomerId: subCustomer._id });
        const ordersWithDetails = await Promise.all(
            orders.map(async (order) => {
                const productDetails = await ProductModel.findById(order.orderDetails[0].productId);
                return {
                    productName: productDetails.name,
                    quantity: order.orderDetails[0].quantity,
                    orderDate: order.orderDate,
                    orderId: order._id, 
                };
            })
        );

        res.render("suborders.ejs", {
            subCustomer,    
            orders: ordersWithDetails  
        });

    } catch (error) {
        console.error("Error fetching sub-customer details and orders:", error);
        res.status(500).send("An error occurred while fetching sub-customer details.");
    }
});
//cutomer(vendor) orders
app.get("/myorders", async (req, res) => {
    if (req.session.userId) {
        try {

            const orders = await OrderModel.find({ customerId: req.session.userId });

            const products = await Promise.all(
                orders.map(async (order) => {
                    const productDetails = await ProductModel.findById(order.orderDetail[0].productId);
                    return { orderId: order._id, productName: productDetails.name };
                })
            );

            const ordersWithProductNames = orders.map((order, index) => ({
                ...order.toObject(),
                productName: products[index].productName
            }));

            console.log("Orders with product names ->", ordersWithProductNames);

            res.render("myorders.ejs", { orders: ordersWithProductNames });

        } catch (error) {
            console.error("Error fetching orders:", error);
            res.status(500).send("An error occurred while fetching orders.");
        }
    } else {
        res.redirect("/login"); 
    }
});
//subcustomer recipt of products
app.get('/download-receipt', async (req, res) => {
    const { orderId } = req.query;
    if (!orderId) {
        return res.status(400).send('Order ID is required');
    }

    try {
        const order = await SubcustomerOrders.findById(orderId)
            .populate('subcustomerId')
            .populate('orderDetails.productId');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        let totalQuantity = 0;
        const products = order.orderDetails.map(detail => {
            const quantity = detail.quantity || 0; 
            totalQuantity += quantity;
            return {
                productId: detail.productId._id,
                productName: detail.productId.name,
                quantity: quantity, 
                price: detail.productId.price,
                total: quantity * detail.productId.price 
            };
        });

        const customer = order.subcustomerId;

        console.log({
            invoiceId: order._id,
            orderId: order._id,
            invoiceDate: order.orderDate.toISOString().split('T')[0],
            dueDate: order.orderDate.toISOString().split('T')[0],
            customerId: customer._id,
            customerName: customer.name,
            customerAddress: customer.address,
            customerEmail: customer.email,
            products: products,
            totalQuantity: totalQuantity,
            status: order.status,
            totalAmount: order.totalPrice
        });

        res.render('invoice', {
            invoiceId: order._id,
            orderId: order._id,
            invoiceDate: order.orderDate.toISOString().split('T')[0],
            dueDate: order.orderDate.toISOString().split('T')[0],
            customerId: customer._id,
            customerName: customer.name,
            customerAddress: customer.address,
            customerEmail: customer.email,
            products: products,
            totalQuantity: totalQuantity,
            status: order.status,
            totalAmount: order.totalPrice
        });

    } catch (err) {
        console.error('Error fetching order:', err);
        res.status(500).send('Internal Server Error');
    }
});

//cutomer(vendor) order deatils
app.get('/order/details/:orderId', async (req, res) => {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid Order ID format" });
    }

    try {

      const order = await OrderModel.findById(orderId).exec();

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const availableSerials = [];
      const soldSerials = [];
      let allocatedQuantity = 0;
      let availableQuantity = 0;
      let pendingQuantity = 0;

      order.orderDetail.forEach(detail => {
        allocatedQuantity += detail.deliveredQuantity + detail.pendingQuantity;

        detail.serialArray.forEach(serial => {
          if (serial.status === 'available') {
            availableSerials.push(serial.serialNumber);
            availableQuantity++;
          } else if (serial.status === 'sold') {
            soldSerials.push(serial.serialNumber);
          }
        });

        pendingQuantity += detail.pendingQuantity;
      });

      res.render('myOrderDetails', {
        order,
        availableSerials,
        soldSerials,
        allocatedQuantity,
        availableQuantity,
        pendingQuantity,
        totalQuantity: order.totalQuantity,  
        orderId: order._id,  
        customerId: order.customerId,  
      });
    } catch (error) {
      console.error("Error fetching order details:", error.message);
      res.status(500).json({ message: "An error occurred while fetching the order details." });
    }
  });

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});