# Store API

A read-only REST API for a sports retail database containing departments, categories, products, customers, orders, and order items.

**Base URL:** `https://storeapi-60py.onrender.com`

---

## Endpoints

### Departments

#### `GET /departments`
Returns all departments.

**Example**
```
GET /departments
```
```json
{
  "data": [
    { "department_id": 2, "department_name": "Fitness" },
    { "department_id": 3, "department_name": "Footwear" }
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
  "data": { "department_id": 2, "department_name": "Fitness" }
}
```

---

### Categories

#### `GET /categories`
Returns all categories. Filter by department with `?department_id=`.

| Query Param | Type | Description |
|---|---|---|
| `department_id` | integer | Filter categories by department |

**Example**
```
GET /categories?department_id=2
```
```json
{
  "data": [
    { "category_id": 9, "category_department_id": 2, "category_name": "Cardio Equipment" },
    { "category_id": 10, "category_department_id": 2, "category_name": "Strength Training" }
  ]
}
```

---

#### `GET /categories/:id`
Returns a single category by ID.

---

### Products

#### `GET /products`
Returns a paginated list of products. Filter by category with `?category_id=`.

| Query Param | Type | Description | Default | Max |
|---|---|---|---|---|
| `category_id` | integer | Filter by category | — | — |
| `limit` | integer | Number of results | 25 | 500 |
| `offset` | integer | Skip N results | 0 | — |

**Example**
```
GET /products?limit=3&offset=0
```
```json
{
  "data": [
    {
      "product_id": 1,
      "product_category_id": 2,
      "product_name": "Quest Q64 10 FT. x 10 FT. Slant Leg Instant U",
      "product_description": "",
      "product_price": 59.98,
      "product_image": "http://images.acmesports.sports/Quest+Q64+10+FT.+x+10+FT.+Slant+Leg+Instant+Up+Canopy"
    }
  ],
  "limit": 3,
  "offset": 0
}
```

---

#### `GET /products/:id`
Returns a single product by ID.

---

### Customers

#### `GET /customers`
Returns a paginated list of customers.

| Query Param | Type | Description | Default | Max |
|---|---|---|---|---|
| `limit` | integer | Number of results | 25 | 500 |
| `offset` | integer | Skip N results | 0 | — |

**Example**
```
GET /customers?limit=2
```
```json
{
  "data": [
    {
      "customer_id": 1,
      "customer_fname": "Richard",
      "customer_lname": "Hernandez",
      "customer_email": "XXXXXXXXX",
      "customer_password": "XXXXXXXXX",
      "customer_street": "6303 Heather Plaza",
      "customer_city": "Brownsville",
      "customer_state": "TX",
      "customer_zipcode": "78521"
    }
  ],
  "limit": 2,
  "offset": 0
}
```

---

#### `GET /customers/:id`
Returns a single customer by ID.

---

### Orders

#### `GET /orders`
Returns a paginated list of orders. Filter by customer or status.

| Query Param | Type | Description | Default | Max |
|---|---|---|---|---|
| `customer_id` | integer | Filter by customer | — | — |
| `status` | string | Filter by status (case-insensitive) | — | — |
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
    }
  ],
  "limit": 2,
  "offset": 0
}
```

---

#### `GET /orders/:id`
Returns a single order by ID.

---

#### `GET /orders/:id/items`
Returns all line items for a specific order.

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

---

## Pagination

Endpoints that return large datasets support `limit` and `offset` query parameters.

```
GET /products?limit=10&offset=20
```

- `limit`: how many records to return (default: 25, max: 500)
- `offset`: how many records to skip (default: 0)
