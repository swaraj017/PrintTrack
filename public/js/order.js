const orderData = JSON.parse(document.getElementById('orderData').textContent);

let selectedSerials = [];
let currentProduct = null;
let selectionMode = 'range';

function populateOrderTable() {
    const tableBody = document.querySelector('#orderTable tbody');
    tableBody.innerHTML = '';
    orderData.orderDetail.forEach(product => {
        const row = `
            <tr>
                <td>${product.productId}</td>
                <td>${product.deliverdQuantity}</td>
                <td><button onclick="customizeProduct('${product._id}')">Customize</button></td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

function customizeProduct(productId) {
    currentProduct = orderData.orderDetail.find(p => p._id === productId);
    document.getElementById('startSerial').value = '1';
    document.getElementById('endSerial').value = currentProduct.deliverdQuantity;
    document.getElementById('startSerial').max = currentProduct.deliverdQuantity;
    document.getElementById('endSerial').max = currentProduct.deliverdQuantity;
    selectedSerials = currentProduct.serialArray.slice(0, currentProduct.deliverdQuantity);
    updateSerialList();
    document.getElementById('serialSelection').style.display = 'block';
    setSelectionMode(selectionMode);
}

function setSelectionMode(mode) {
    selectionMode = mode;
    document.getElementById('rangeSelection').style.display = mode === 'range' ? 'block' : 'none';
    document.getElementById('individualSelection').style.display = mode === 'individual' ? 'block' : 'none';
    if (mode === 'range') {
        filterSerialRange();
    } else {
        updateSerialList();
    }
}

function filterSerialRange() {
    const start = parseInt(document.getElementById('startSerial').value) - 1;
    const end = parseInt(document.getElementById('endSerial').value);
    if (start >= 0 && end <= currentProduct.deliverdQuantity && start < end) {
        selectedSerials = currentProduct.serialArray.slice(start, end);
        updateSerialList();
    } else {
        alert('Invalid range. Please ensure start is less than end and within the delivered quantity.');
    }
}

function filterSerials() {
    const filterValue = document.getElementById('serialFilter').value.toLowerCase();
    const serialItems = document.querySelectorAll('.serial-item');
    serialItems.forEach(item => {
        const serial = item.textContent.toLowerCase();
        if (serial.includes(filterValue)) {
            item.style.display = 'inline-block';
        } else {
            item.style.display = 'none';
        }
    });
}

function updateSerialList() {
    const serialList = document.getElementById('serialList');
    serialList.innerHTML = '';
    const serials = selectionMode === 'range' ? selectedSerials : currentProduct.serialArray.slice(0, currentProduct.deliverdQuantity);
    serials.forEach(serial => {
        const serialItem = document.createElement('div');
        serialItem.className = 'serial-item';
        if (selectionMode === 'individual') {
            serialItem.classList.toggle('selected', selectedSerials.includes(serial));
            serialItem.onclick = () => toggleSerialSelection(serial, serialItem);
        }
        serialItem.textContent = serial;
        serialList.appendChild(serialItem);
    });
    document.getElementById('selectedQuantity').value = selectedSerials.length;
}

function toggleSerialSelection(serial, element) {
    if (selectionMode === 'individual') {
        const index = selectedSerials.indexOf(serial);
        if (index === -1) {
            selectedSerials.push(serial);
            element.classList.add('selected');
        } else {
            selectedSerials.splice(index, 1);
            element.classList.remove('selected');
        }
        document.getElementById('selectedQuantity').value = selectedSerials.length;
    }
}

function confirmSelection() {
    alert(`Selected ${selectedSerials.length} serial numbers`);
}

function generateInvoice() {
    const product = currentProduct || orderData.orderDetail[0];
    const serialsToUse = selectedSerials.length > 0 ? selectedSerials : product.serialArray.slice(0, product.deliverdQuantity);
    const invoiceHtml = `
        <div>
            <h2>Invoice</h2>
            <p><strong>PrintTrack Inc.</strong></p>
            <p>123 Print Street, Ink City, 12345</p>
            <hr>
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> ${orderData._id}</p>
            <p><strong>Customer ID:</strong> ${orderData.customerId}</p>
            <p><strong>Order Date:</strong> ${new Date(orderData.orderDate).toLocaleDateString()}</p>
            <p><strong>Total Price:</strong> $${orderData.totalPrice.toLocaleString()}</p>
            <h3>Products</h3>
            <ul>
                <li>
                    Product ID: ${product.productId}<br>
                    Quantity: ${serialsToUse.length}<br>
                    Serial Numbers: ${serialsToUse.join(', ')}
                </li>
            </ul>
        </div>
    `;
    document.getElementById('invoicePreview').innerHTML = invoiceHtml;
}

populateOrderTable();
