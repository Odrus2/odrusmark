# Turn on the Odrusmark AI project copilot

The dashboard copilot has three guided tasks: clarify a client brief, draft an investigation plan, and research a project question with clickable source links. It also answers questions using the selected project details and Odrusmark progress updates. It saves each project conversation privately. It does not read attachments, alter project records, or publish official findings.

## 1. Apply the database migration

Because the original Odrusmark SQL has already been run, open **Supabase → SQL Editor → New query**, paste all of `supabase-ai.sql`, and run it. This adds the project update and AI conversation tables, RLS policies, and daily usage limits without deleting existing projects.

## 2. Add an OpenAI API key to Supabase

Create an API key in your OpenAI API account and enable API billing. API use is billed separately from ChatGPT plans. Check the current [OpenAI API pricing](https://platform.openai.com/pricing) and set a spend limit before inviting clients.

In Supabase, open **Edge Functions → Secrets**, add a secret named `OPENAI_API_KEY`, paste its value, and save. Never paste the secret into this repository or `js/config.js`.

## 3. Deploy the authenticated function

In Supabase, go to **Edge Functions → Deploy a new function → Via Editor**. Create a function named `odrusmark-copilot`, replace the starter code with the complete contents of `supabase/functions/odrusmark-copilot/index.ts`, turn off the gateway JWT verification toggle, and deploy. The function itself uses Supabase's `createSupabaseContext(..., { auth: "user" })` to validate the signed-in user, as recommended when using modern Supabase API keys. A public key by itself is not sufficient to use the function. The source is in GitHub for version control; a change to the source file does not update the deployed function until it is deployed again.

The function requires a signed-in Supabase session, verifies project ownership through RLS, enforces daily use limits, and keeps the OpenAI key on the server. Its default model is `gpt-6-astra`; if your API project cannot use that model, add a Supabase function secret named `OPENAI_MODEL` with a model that is available to your API project.

## 4. Publish the website update

Extract the updated site package and copy its files into the root of the `odrusmark` GitHub repository. Merge/replace the listed `css`, `js`, and `supabase` files and the SQL/HTML files. Keep your existing `js/config.js`; the package intentionally does not contain that file. Commit the changes and let GitHub Pages publish them.

## 5. Test with a project you own

Sign into a client account, open the dashboard, select one of that account's projects, accept the AI data-use notice, and try **Clarify my project**, **Draft an investigation plan**, then **Research with sources**. The research response should include clickable sources. Confirm the conversation remains visible after refreshing the page.

Each client gets up to 30 standard copilot messages and 5 web research runs per UTC day. Before using this with real client data, update Odrusmark's privacy notice to explain that the selected project brief, recent Odrusmark updates and chat are sent to OpenAI. Attachments are not sent. AI responses remain drafts until Odrusmark staff verify them.
