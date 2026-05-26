import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CUSTOMER_CSV = `first_name,last_name,email,phone,company
John,Doe,john.doe@example.com,+1-555-010-2026,Test Corp
Jane,Smith,jane.smith@example.com,+1-555-020-3037,Sample Inc
Alex,Johnson,alex.johnson@example.com,+1-555-030-4048,Demo LLC`;

const PRODUCT_CSV = `name,type,sku,price,weight,description,inventory_level
Test Product - BC Importer,physical,TEST-001,29.99,1.0,A test product created via BC Bulk Importer,100
Blue Cotton T-Shirt,physical,TSHIRT-BLU-M,19.99,0.3,100% cotton t-shirt in blue - Medium,250
Wireless Mouse,physical,MOUSE-WL-001,49.99,0.2,Ergonomic wireless mouse with USB receiver,75`;

const ORDER_CSV = `email,first_name,last_name,product_sku,quantity,street_1,city,state,zip,country,country_iso2,tracking_number,tracking_carrier,tracking_comments
john.doe@example.com,John,Doe,TEST-001,1,123 Test Street,New York,New York,10001,United States,US,1Z999AA10123456784,ups,Your order has been shipped!
jane.smith@example.com,Jane,Smith,TSHIRT-BLU-M,2,456 Main St,Los Angeles,California,90001,United States,US,9400111899223397860538,usps,
alex.johnson@example.com,Alex,Johnson,MOUSE-WL-001,1,789 Oak Ave,Chicago,Illinois,60601,United States,US,,,`;

router.get("/templates/customers", (_req, res): void => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=customers_template.csv");
  res.send(CUSTOMER_CSV);
});

router.get("/templates/products", (_req, res): void => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=products_template.csv");
  res.send(PRODUCT_CSV);
});

router.get("/templates/orders", (_req, res): void => {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=orders_template.csv");
  res.send(ORDER_CSV);
});

export default router;
