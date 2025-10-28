<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1QUvK-D-3di3SeX9DVa4XP6J71dZqLrAs

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

Prompt for AI Assistant (e.g., Codex)
Goal: Create a comprehensive, step-by-step guide on how to deploy the "Cera Brasileira" e-commerce application. The guide should be clear enough for a developer to follow from their local Visual Studio Code environment to a live production setup.

Project Context:

The application consists of two main parts:

Frontend: A static React application written in TypeScript. It uses an importmap in index.html for dependencies, so there is no npm install or build step (e.g., npm run build) required for the frontend code. All files (.html, .tsx, .ts) are served as-is.
Backend: Powered entirely by Supabase, which includes a PostgreSQL database, Authentication, Storage, and several serverless Edge Functions.
The application also integrates with several third-party APIs, whose keys are managed as secrets within Supabase.

Deployment Instructions to Generate:
Please generate a detailed guide covering the following four parts:

Part 1: Setting Up the Supabase Backend

This is the foundational step. The guide must include:

Create a Supabase Project:
Instructions to sign up/log in at supabase.com and create a new project.
Advise the user to save the Project URL and anon public key.
Database Schema Setup:
Explain that the database tables need to be created.
Instruct the AI to generate the necessary SQL CREATE TABLE statements by analyzing the following files to infer the schema:
types.ts: For Product, ProductVariant, Order, Customer, etc.
services/supabaseService.ts: For query patterns that reveal table names (products, product_variants, orders, customers, profiles) and column names.
supabase/functions/create-order/index.ts: Specifically, analyze the call to the create_full_order_with_variants RPC function to understand its arguments, which correspond to the data structure needed.
Instruct the AI to also generate the PostgreSQL function create_full_order_with_variants based on the arguments passed to it in the create-order Edge Function.
Provide instructions on where to run this SQL (in the Supabase Dashboard under SQL Editor).
Configure Supabase Auth:
Explain that the profiles table is used for user data. Provide instructions for setting up the trigger that automatically creates a new profile when a user signs up.
Guide the user on how to enable OAuth providers (Google, Apple) in the Supabase Dashboard under Authentication -> Providers.
Configure Supabase Storage:
Instruct the user to create a new public Storage bucket named product-images.
Provide the exact steps or policy JSON to make the bucket publicly readable.
Set Up Supabase Secrets:
List all the required secrets that must be added to the Supabase project. The AI should extract this list from the various Edge Function files (*.ts inside supabase/functions/).
The list must include: ADMIN_EMAIL, RAJAONGKIR_KEY, MIDTRANS_SERVER_KEY, KOMERCE_API_KEY, RESEND_API_KEY, CONTACT_EMAIL_RECIPIENT.
Provide clear instructions: "Go to Project Settings -> Edge Functions -> Add new secret."
Deploy Supabase Edge Functions:
Explain the need for the Supabase CLI.
Provide the commands to install the CLI (npm install -g supabase).
Provide the sequence of commands to deploy the functions from the local supabase/functions directory:
code
Bash
# Log in to Supabase
supabase login

# Link the local project to your Supabase project
supabase link --project-ref <YOUR_PROJECT_ID>

# Deploy all Edge Functions
supabase functions deploy
Part 2: Configuring and Deploying the Frontend

Update Supabase Credentials:
This is a critical step. Instruct the user to open services/supabase.ts and replace the placeholder supabaseUrl and supabaseKey with the Project URL and anon public key from their new Supabase project.
Update Meta App ID:
Instruct the user to open services/metaService.ts and replace the placeholder META_APP_ID with their actual App ID from the Meta for Developers dashboard.
Choose a Hosting Option (Static Host):
Explain that because the site is static, it can be hosted anywhere. Recommend Vercel or Netlify for ease of use.
Vercel/Netlify Instructions: Guide the user to connect their Git repository (GitHub, GitLab) to Vercel/Netlify. Explain that no build command or publish directory is needed. The root directory should be used.
Part 3: Final Configuration and Admin Setup

Set the Administrator:
Reiterate the importance of the ADMIN_EMAIL secret in Supabase.
Instruct the user to set this secret to their own email address. This email will be the only one with access to the Admin Dashboard.
Obtain Third-Party API Keys:
Briefly mention that the user needs to sign up for each third-party service (RajaOngkir, Midtrans, Komerce, Resend, Meta for Developers) to get the API keys required for the Supabase secrets.
Part 4: Summary and Testing

Provide a quick checklist to ensure all steps were followed.
Advise the user to visit their deployed frontend URL, create an account, log in with the admin email, and verify that they can access the Admin Dashboard.
Suggest testing the checkout process to ensure all Edge Functions and API integrations are working correctly.