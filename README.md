# SellMate NG

SellMate NG is a WhatsApp commerce platform for Nigerian sellers. It gives each seller a public product shop, cart, checkout flow, order management dashboard, customer records, receipts, inventory tracking, and billing.

## Who The App Is For

SellMate NG has two main sides:

- Customer side: customers browse products, add items to cart, enter delivery details, pay with Paystack, and send a receipt-style order message to the seller on WhatsApp.
- Seller side: sellers log in to manage products, product images, prices, stock, orders, customers, receipts, delivery fee, store logo, business details, and payout settings.

The main homepage belongs to the SellMate NG platform. The store, cart, checkout, and customer footer use the seller's own brand name/logo.

## Main Features

- Seller registration and login
- Seller dashboard
- Product management with categories, variants, stock, and image upload
- Public storefront for each seller
- Product search
- Cart and checkout
- Editable delivery fee from seller settings
- Paystack test payment flow
- Seller payout/subaccount setup
- Subscription billing plans
- WhatsApp receipt message after successful payment
- Responsive dashboard navigation for desktop and mobile
- Seller logo setup with image or text logo

## Important Pages

- `/` - SellMate NG homepage
- `/register` - create seller account
- `/login` - seller login
- `/dashboard` - seller dashboard
- `/dashboard/products` - add and manage products
- `/dashboard/orders` - view customer orders
- `/dashboard/customers` - customer list
- `/dashboard/inventory` - stock management
- `/dashboard/analytics` - store analytics
- `/dashboard/receipts` - receipts
- `/dashboard/settings` - business profile, logo, delivery fee, WhatsApp, and payout account
- `/dashboard/billing` - seller subscription plans
- `/store/[slug]` - public seller storefront
- `/cart` - customer cart
- `/checkout` - customer delivery and payment page
- `/payment/callback` - payment result page

## How Payment Works

Customers pay for goods through Paystack checkout.

After payment succeeds:

1. The order is marked as paid.
2. Product stock is reduced.
3. The customer sees a WhatsApp button.
4. WhatsApp opens with a neat receipt-style order message ready to send to the seller.

For testing, use Paystack test keys first. Switch to live Paystack keys only after testing the deployed site on phone and desktop.

## Seller Subscription Idea

The app supports seller plans:

- Free trial: limited product count
- Starter: paid plan for more products
- Pro: higher product limit
- Business: unlimited package with monthly renewal

When a seller reaches the product limit, the app can block new product creation until the seller upgrades.

## Environment Variables

Create `.env.local` for local development. Do not commit this file.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
PAYSTACK_SECRET_KEY=
```

On deployment, add these same environment variables in the hosting dashboard.

## Supabase SQL Updates

Run these in Supabase SQL Editor if they have not been added already:

```sql
alter table public.products
add column if not exists variant_options text,
add column if not exists image_url text;

alter table public.seller_profiles
add column if not exists bank_code text,
add column if not exists bank_name text,
add column if not exists account_number text,
add column if not exists account_name text,
add column if not exists paystack_subaccount_code text,
add column if not exists delivery_fee numeric default 3500,
add column if not exists billing_renews_at timestamptz,
add column if not exists logo_url text,
add column if not exists logo_text text;
```

## Run Locally

On Windows PowerShell:

```powershell
npm.cmd install
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

## Build Check

```powershell
npm.cmd run build
```

## Recommended GitHub Repo Name

Use:

```text
sellmate-ng
```

It is short, clear, and matches the product name.

## Deployment Notes

Recommended deployment flow:

1. Push this project to GitHub.
2. Import the GitHub repo into Vercel.
3. Add the environment variables in Vercel.
4. Deploy.
5. Test registration, login, product creation, storefront, cart, checkout, and Paystack test payment on phone.
6. After testing, switch Paystack from test keys to live keys.
