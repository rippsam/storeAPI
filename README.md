# Store API

A free, read-only REST API for a sports retail store. Contains real data: **7 departments**, **57 categories**, **1,345 products**, **12,435 customers**, **68,883 orders**, and **172,198 order items**. No sign-up or API key required — just make a GET request.

**Base URL:** `https://storeapi-60py.onrender.com`

> **Heads up — cold starts:** The API runs on a free server that spins down after 15 minutes of inactivity. Your first request after an idle period may take 15–30 seconds to respond while the server wakes up. Subsequent requests will be fast. If a request seems to hang, just wait — it is not broken.

---

## Quick Start

No setup required. Pick any method below and try it now:

**In your browser** — paste this URL into the address bar and press Enter:
```
https://storeapi-60py.onrender.com/products?limit=3
```

**JavaScript (fetch)**
```js
fetch('https://storeapi-60py.onrender.com/products?limit=3')
  .then(response => response.json())
  .then(data => console.log(data));
```

**curl (terminal)**
```
curl "https://storeapi-60py.onrender.com/products?limit=3"
```

**Postman or Insomnia** — create a new GET request, paste in the URL, and click Send.

---

## How the data fits together

```
Departments  →  Categories  →  Products
                                   ↑
                    Order Items ───┘
                         ↑
Customers  →  Orders ────┘
```

- A **department** (e.g. "Sports") contains many **categories** (e.g. "Football", "Basketball")
- A **category** contains many **products**
- A **customer** can have many **orders**
- An **order** contains one or more **order items**, each referencing a specific **product**

---

## Response format

Every response wraps its result in a `data` field:

```json
{ "data": { ... } }      ← a single object  (e.g. one product)
{ "data": [ ... ] }      ← an array         (e.g. a list of products)
```

List endpoints also include `total`, `limit`, and `offset`:

```json
{
  "data": [ ... ],
  "total": 1345,
  "limit": 25,
  "offset": 0
}
```

| Field | Description |
|---|---|
| `total` | Total number of matching records across all pages |
| `limit` | How many records were requested |
| `offset` | How many records were skipped |

When something goes wrong, responses use an `error` field instead of `data`:

```json
{ "error": "Product not found" }
```

---

## Pagination

List endpoints support `limit` and `offset` to page through large datasets.

| Param | Type | Description | Default | Max |
|---|---|---|---|---|
| `limit` | integer | How many records to return | 25 | 500 |
| `offset` | integer | How many records to skip | 0 | — |

**Example — fetch page 3 at 10 results per page:**
```
GET /products?limit=10&offset=20
```

**Calculate total pages from a response:**
```js
const totalPages = Math.ceil(data.total / data.limit);
```

Invalid values (non-integers, negative numbers) fall back to their defaults.

---

## HTTP Status Codes

| Code | Meaning |
|---|---|
| `200 OK` | Request succeeded |
| `404 Not Found` | The requested resource does not exist |
| `500 Internal Server Error` | Something went wrong on the server |

---

## Endpoints

### `GET /`

Returns an overview of the API: a description, record counts, and a list of all available endpoints. A good place to start.

**Example**
```
GET /
```
```json
{
  "name": "Store API",
  "description": "Read-only REST API for a sports retail store",
  "base_url": "https://storeapi-60py.onrender.com",
  "counts": {
    "departments": 7,
    "categories": 57,
    "products": 1345,
    "customers": 12435,
    "orders": 68883
  },
  "endpoints": [
    "GET /",
    "GET /departments",
    "GET /departments/:id",
    "..."
  ]
}
```

---

### Departments

#### `GET /departments`
Returns all 7 departments.

**Example**
```
GET /departments
```
```json
{
  "data": [
    { "department_id": 2, "department_name": "Sports" },
    { "department_id": 3, "department_name": "Fitness" },
    { "department_id": 4, "department_name": "Footwear" },
    { "department_id": 5, "department_name": "Apparel" },
    { "department_id": 6, "department_name": "Golf" },
    { "department_id": 7, "department_name": "Outdoors" },
    { "department_id": 8, "department_name": "Fan Shop" }
  ]
}
```

---

#### `GET /departments/:id`
Returns a single department by ID.

**Example**
```
GET /departments/2
```
```json
{
  "data": { "department_id": 2, "department_name": "Sports" }
}
```

**If the ID does not exist:**
```json
{ "error": "Department not found" }
```

---

#### `GET /departments/:id/categories`
Returns all categories that belong to the given department. A convenient shortcut for `GET /categories?department_id=:id`.

**Example**
```
GET /departments/2/categories
```
```json
{
  "data": [
    { "category_id": 2, "category_department_id": 2, "category_name": "Football" },
    { "category_id": 3, "category_department_id": 2, "category_name": "Soccer" },
    { "category_id": 4, "category_department_id": 2, "category_name": "Baseball & Softball" },
    { "category_id": 5, "category_department_id": 2, "category_name": "Basketball" },
    { "category_id": 6, "category_department_id": 2, "category_name": "Tennis & Racquet" },
    { "category_id": 7, "category_department_id": 2, "category_name": "Hockey" },
    { "category_id": 8, "category_department_id": 2, "category_name": "More Sports" }
  ]
}
```

---

### Categories

#### `GET /categories`
Returns all 57 categories. Optionally filter by department.

| Query Param | Type | Description |
|---|---|---|
| `department_id` | integer | Only return categories in this department |

**Example**
```
GET /categories?department_id=2
```
```json
{
  "data": [
    { "category_id": 2, "category_department_id": 2, "category_name": "Football" },
    { "category_id": 3, "category_department_id": 2, "category_name": "Soccer" }
  ]
}
```

---

#### `GET /categories/:id`
Returns a single category by ID.

**Example**
```
GET /categories/5
```
```json
{
  "data": { "category_id": 5, "category_department_id": 2, "category_name": "Basketball" }
}
```

---

### Products

#### `GET /products`
Returns a paginated list of products. Optionally filter by category.

| Query Param | Type | Description | Default | Max |
|---|---|---|---|---|
| `category_id` | integer | Only return products in this category | — | — |
| `limit` | integer | Number of results | 25 | 500 |
| `offset` | integer | Skip N results | 0 | — |

**Example**
```
GET /products?limit=2&offset=0
```
```json
{
  "data": [
    {
      "product_id": 1,
      "product_category_id": 2,
      "product_name": "Quest Q64 10 FT. x 10 FT. Slant Leg Instant U",
      "product_description": "Easy-to-assemble 10x10 ft canopy with slant leg design provides instant shade and versatility for outdoor events or camping.",
      "product_price": 59.98,
      "product_image": "https://storeapi-60py.onrender.com/images/1563.png"
    },
    {
      "product_id": 2,
      "product_category_id": 2,
      "product_name": "Under Armour Men's Highlight MC Football Clea",
      "product_description": "Lightweight, breathable football cleats for speed and agility with Micro G unit for shock absorption.",
      "product_price": 129.99,
      "product_image": "https://storeapi-60py.onrender.com/images/1824.png"
    }
  ],
  "total": 1345,
  "limit": 2,
  "offset": 0
}
```

---

#### `GET /products/search`
Search products by name. Case-insensitive, matches anywhere in the product name.

| Query Param | Type | Description | Default | Max |
|---|---|---|---|---|
| `q` | string | The search term | — | — |
| `limit` | integer | Number of results | 25 | 500 |
| `offset` | integer | Skip N results | 0 | — |

**Example**
```
GET /products/search?q=basketball&limit=2
```
```json
{
  "data": [
    {
      "product_id": 74,
      "product_category_id": 5,
      "product_name": "Goaliath 54\" In-Ground Basketball Hoop with P",
      "product_description": "Durable in-ground basketball hoop designed for long-lasting outdoor play, featuring a 54\" backboard and adjustable pole.",
      "product_price": 499.99,
      "product_image": "https://storeapi-60py.onrender.com/images/681.png"
    }
  ],
  "total": 48,
  "limit": 2,
  "offset": 0
}
```

---

#### `GET /products/:id`
Returns a single product by ID.

**Example**
```
GET /products/19
```
```json
{
  "data": {
    "product_id": 19,
    "product_category_id": 2,
    "product_name": "Nike Men's Fingertrap Max Training Shoe",
    "product_description": "The Nike Men's Fingertrap Max Training Shoe features a lightweight design and responsive midsole for enhanced comfort and performance.",
    "product_price": 124.99,
    "product_image": "https://storeapi-60py.onrender.com/images/1858.png"
  }
}
```

**If the ID does not exist:**
```json
{ "error": "Product not found" }
```

---

#### `GET /products/:id/images`
Returns an ordered array of image URLs for a product. Most products have 1–3 images. The first image always matches the `product_image` field on the product itself.

**Example**
```
GET /products/1/images
```
```json
{
  "data": [
    "https://storeapi-60py.onrender.com/images/1563.png",
    "https://storeapi-60py.onrender.com/images/1626.png"
  ]
}
```

---

### Customers

#### `GET /customers`
Returns a paginated list of customers.

| Query Param | Type | Description | Default | Max |
|---|---|---|---|---|
| `limit` | integer | Number of results | 25 | 500 |
| `offset` | integer | Skip N results | 0 | — |

> **Note:** `customer_email` is stored as `XXXXXXXXX` in this dataset — the original emails were redacted for privacy before the data was published. `customer_password` is never returned by this API.

**Example**
```
GET /customers?limit=1
```
```json
{
  "data": [
    {
      "customer_id": 1,
      "customer_fname": "Richard",
      "customer_lname": "Hernandez",
      "customer_email": "XXXXXXXXX",
      "customer_street": "6303 Heather Plaza",
      "customer_city": "Brownsville",
      "customer_state": "TX",
      "customer_zipcode": "78521"
    }
  ],
  "total": 12435,
  "limit": 1,
  "offset": 0
}
```

---

#### `GET /customers/:id`
Returns a single customer by ID.

**Example**
```
GET /customers/1
```
```json
{
  "data": {
    "customer_id": 1,
    "customer_fname": "Richard",
    "customer_lname": "Hernandez",
    "customer_email": "XXXXXXXXX",
    "customer_street": "6303 Heather Plaza",
    "customer_city": "Brownsville",
    "customer_state": "TX",
    "customer_zipcode": "78521"
  }
}
```

---

#### `GET /customers/:id/orders`
Returns all orders placed by a specific customer. Paginated.

| Query Param | Type | Description | Default | Max |
|---|---|---|---|---|
| `limit` | integer | Number of results | 25 | 500 |
| `offset` | integer | Skip N results | 0 | — |

**Example**
```
GET /customers/11599/orders
```
```json
{
  "data": [
    {
      "order_id": 1,
      "order_date": "2013-07-25 00:00:00",
      "order_customer_id": 11599,
      "order_status": "CLOSED"
    },
    {
      "order_id": 11397,
      "order_date": "2013-10-03 00:00:00",
      "order_customer_id": 11599,
      "order_status": "COMPLETE"
    }
  ],
  "total": 5,
  "limit": 25,
  "offset": 0
}
```

---

### Orders

#### `GET /orders`
Returns a paginated list of orders. Filter by customer or status.

| Query Param | Type | Description | Default | Max |
|---|---|---|---|---|
| `customer_id` | integer | Only return orders for this customer | — | — |
| `status` | string | Filter by order status (case-insensitive) | — | — |
| `limit` | integer | Number of results | 25 | 500 |
| `offset` | integer | Skip N results | 0 | — |

**Valid status values:** `COMPLETE`, `CLOSED`, `PENDING`, `PENDING_PAYMENT`, `PROCESSING`, `CANCELED`, `ON_HOLD`, `PAYMENT_REVIEW`, `SUSPECTED_FRAUD`

**Example**
```
GET /orders?status=complete&limit=2
```
```json
{
  "data": [
    {
      "order_id": 3,
      "order_date": "2013-07-25 00:00:00",
      "order_customer_id": 12111,
      "order_status": "COMPLETE"
    },
    {
      "order_id": 5,
      "order_date": "2013-07-25 00:00:00",
      "order_customer_id": 11318,
      "order_status": "COMPLETE"
    }
  ],
  "total": 22899,
  "limit": 2,
  "offset": 0
}
```

---

#### `GET /orders/:id`
Returns a single order by ID.

**Example**
```
GET /orders/1
```
```json
{
  "data": {
    "order_id": 1,
    "order_date": "2013-07-25 00:00:00",
    "order_customer_id": 11599,
    "order_status": "CLOSED"
  }
}
```

---

#### `GET /orders/:id/items`
Returns all line items in a specific order. Each item includes the product ID, quantity, and price paid at the time of purchase.

To get full product details for an item, use `order_item_product_id` with `GET /products/:id`.

**Example**
```
GET /orders/1/items
```
```json
{
  "data": [
    {
      "order_item_id": 1,
      "order_item_order_id": 1,
      "order_item_product_id": 957,
      "order_item_quantity": 1,
      "order_item_subtotal": 299.98,
      "order_item_product_price": 299.98
    }
  ]
}
```

**If the order ID does not exist:**
```json
{ "error": "Order not found" }
```
