const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');

const { CustomerModel, ProductModel, ProductVariantModel, OrderModel, InvoiceModel } = require('./schema');

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

const dburl = "mongodb+srv://swarajgaikwad:swaraj1991@cluster0.ggxns9s.mongodb.net/wholesaler-dashboard?retryWrites=true&w=majority&appName=Cluster0" + '?ssl=true';

async function main() {
    await mongoose.connect(dburl);
}
main().then(() => { console.log('MongoDB connected'); });

app.get("/index", (req, res) => {
    res.render("index.ejs");
});

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

app.get("/profile", async (req, res) => {
    try {
        const userData = await CustomerModel.findById(req.session.userId);

        if (userData) {
            console.log("Profile Info", userData);
            res.render("user.ejs",{ user: userData });
        } else {
            res.send("User not found.");
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
        res.status(500).send("An error occurred while fetching the user profile.");
    }
});

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

app.post('/putOrder', async (req, res) => {
    const { customerId, productId, totalQuantity, deliverdQuantity, pendingQuantity, totalPrice, orderDate } = req.body;

    const productObjectId = new mongoose.Types.ObjectId(productId);

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
            serialNumbers.push(serial);
        }
        return serialNumbers;
    };

    const serialNumbers = generateSerialNumbers(deliverdQuantity);

    const newOrder = new OrderModel({
        customerId, 
        orderDetail: [
            {
                productId: product._id,
                totalQuantity,
                deliverdQuantity,
                pendingQuantity,
                serialArray: serialNumbers,
            },
        ],
        totalPrice,
        orderDate,
    });

    try {
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

app.get('/order/:id', async (req, res) => {
    const orderId = req.params.id;

    try {
        const order = await OrderModel.findById(orderId);
        
        if (!order) {
            return res.status(404).send("Order not found");
        }

        const serialArray = order.orderDetail.map(detail => detail.serialArray);
        console.log(order,"\n",serialArray)
        res.render('order.ejs', {
            order: order,
            serialArrays: serialArray
        });
    } catch (err) {
        return res.status(500).send("Internal Server Error");
    }
});
app.get("/getinvoice", async (req, res) => {
    const {
        orderId,
        customerId,
        orderDate,
        totalPrice,
        productId,
        quantity,
        serials
    } = req.query;

    try {
        const customer = await CustomerModel.findById(customerId);
        if (!customer) {
            return res.status(404).send("Customer not found.");
        }

        const product = await ProductModel.findById(productId);
        if (!product) {
            return res.status(404).send("Product not found.");
        }

        const invoiceData = {
            invoiceId: "INV" + Math.floor(Math.random() * 100000),
            orderId: orderId,
            invoiceDate: new Date().toLocaleDateString(),
            dueDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toLocaleDateString(),
            customerId: customerId,
            customerName: customer.name,
            customerAddress: customer.address,
            customerEmail: customer.email,
            products: [
                {
                    productId: productId,
                    productName: product.name,
                    quantity: quantity,
                    price: product.price,
                    total: (quantity * product.price).toFixed(2)
                }
            ],
            totalAmount: (quantity * product.price).toFixed(2),
            status: "paid"
        };

        res.render('invoice', invoiceData);

    } catch (error) {
        console.error("Error generating invoice:", error);
        res.status(500).send("An error occurred while generating the invoice.");
    }
});
const puppeteer = require('puppeteer');

app.get("/downloadinvoice", async (req, res) => {
    const {
        orderId,
        customerId,
        orderDate,
        totalPrice,
        productId,
        quantity,
        serials
    } = req.query;

    try {
        const customer = await CustomerModel.findById(customerId);
        const product = await ProductModel.findById(productId);

        if (!customer || !product) {
            return res.status(404).send("Customer or Product not found.");
        }

        const invoiceData = {
            invoiceId: "INV" + Math.floor(Math.random() * 100000),
            orderId: orderId,
            invoiceDate: new Date(orderDate).toLocaleDateString(),
            dueDate: new Date(new Date(orderDate).setMonth(new Date(orderDate).getMonth() + 1)).toLocaleDateString(),
            customerId: customerId,
            customerName: customer.name,
            customerAddress: customer.address,
            customerEmail: customer.email,
            products: [
                {
                    productId: productId,
                    productName: product.name,
                    quantity: quantity,
                    price: product.price,
                    total: (quantity * product.price).toFixed(2)
                }
            ],
            totalAmount: (quantity * product.price).toFixed(2),
            status: "paid",
            serials: serials
        };

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        const content = await ejs.renderFile(path.join(__dirname, 'views', 'invoice.ejs'), invoiceData);
        await page.setContent(content);
        const pdfBuffer = await page.pdf({ format: 'A4' });

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="invoice.pdf"',
        });
        res.send(pdfBuffer);

        await browser.close();
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send("Failed to generate the PDF.");
    }
});



app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});

