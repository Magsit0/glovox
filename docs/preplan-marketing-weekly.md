Read docs/STYLE_DASHBOARD.md in full before doing anything else.
Read docs/biquery-schema.md as a reference for where to get the data for the dashboard.

We are building a marketing dashboard. All visual decisions — colors, typography, borders, shadows, spacing, motion, and component structure — must follow the spec in that file exactly. No defaults from any library should be left unoverridden.

Stack:

- Next.js App Router + TypeScript
- Tailwind CSS (utility classes only)
- 21st-dev/magic for component generation (override to match spec after)
- motion (emilkowalski) for all animations
- recharts for charts (restyled to spec palette)

Once you confirm you've read the style guide, I'll describe the data and metrics for the first view.

I need a dashboard for marketing weekly meetings under the route marketing/weekly.
The main verticals of marketing are:

- paid media (mainly Meta Ads, Meta Boosts, but also Google Ads and TikTok Ads)
- organic media (social media, content marketing, linktree)
- club glovox (referral program)
- email marketing (newsletters, automated campaigns)

It is interesting for the team to understand the how the sales are going, what strategies are working, liquidity for paid media, how the organic media is performing, how the referral program is performing, how the email marketing is performing, and how the event is performing in general.
For that we have two methods of tracking:

1. UTM parameters (content, medium, source, campaign, term). We use this mainly to track Google Analytics traffic, sessions, users in the different stages of the purchase funnel.
2. A referral parameter in the ticket seller url that get stored in the data base if the ticket was bought through that link.
   here is an example of a link: where "ref_ff_ff1" is the parameter that is going to be stores in the ticket in the column Referido
   https://www.puntoticket.com/ref/GLO198/ref_ff_ff1?utm_source=ff&utm_medium=ref&utm_campaign=grid_2026_05_09&utm_content=ff1

I- First secction: Event summary. How is the event going?

1. ticket sales chart overtime: how is the event selling compared to other events of the same class (I have to specify the class of the event, there is a table for that) ticket goal
2. paid media section with: total invested, budget, percentage of budget execution, and how many tickets paid media has sold. cpa, cpa paid media.
3. table with sales origin by referrer (linktree, refferal club, paid media, mailing)
4. instagram followers evolution during the campaign
5. refferral club sales during the campaign
6. refferral club members evolution during the campaign
7. chart sales per category in time + CPA or paid media spend

funnel chart in time

Referral Volume vs Engagement Quality: Sessions vs. Engagement/Sessions

CURVA DESGLOSE POR TIPO DE CAMPAÑA del looker

In the following sections I will describe the data and metrics and where to get that from BigQuery and give some queries as examples.

use table to get all the events that are available to analyze

filtrar por categoría evento

# TODO:

1. Second section: Last week analysis. How was the last week?
   Compare last week with an ideal week (the KPI curve they tell you) and with an average week of that event. Directly and porcentually.
2. a view for analyzing how creativities are performing, this is how much they are converting in paid media and how much engagement they are generating in organic media.

3. Additional metrics I'd recommend

Based on what you already have in BigQuery:

- Funnel conversion rates by channel — you have google_analytics.funnel with step-by-step data. Showing conversion rate (page_view
  → add_to_cart → purchase) broken down by UTM source/medium tells you which channel converts best, not just which drives traffic.
- Average ticket price over time — detects discounting fatigue (are you selling more tickets but earning less per ticket as you  
  move from Preventa 1 → Normal?).
- Bounce rate by source — utm.bounce_rate is already there. High bounce from paid media = bad creative/landing page match.
- Days-to-event vs sales velocity — how many tickets sell per day as the event approaches. Shows if urgency kicks in and when.
- Repeat buyer rate — same Rut across multiple events. Tells you about retention and brand loyalty.
- Promo code effectiveness — CodigoPromocion is tracked. Which codes drive volume vs cannibalize full-price?
- Community seller activation rate — of all club members, what % actually generated a sale this campaign?

2. What I still need from you

These data sources are not in your BigQuery schema and I can't build those sections without them:

┌─────────────────────┬────────────────────────────┬─────────────────────────────────────────────────────────────────────────┐  
 │ Missing data │ Needed for │ Question │
├─────────────────────┼────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤  
 │ Event │ Comparing events of "the │ You mentioned it exists — where? Is it in BigQuery or a config file? │
│ classification │ same class" │ What are the columns? │
│ table │ │ │  
 ├─────────────────────┼────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
│ Paid media spend │ Budget, investment, % │ Where does Meta/Google/TikTok ad spend live? A spreadsheet? An API? A │  
 │ data │ execution, CPA │ BigQuery table I don't see? │
├─────────────────────┼────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤  
 │ Budget/goals per │ Ticket goal line on the │ Is this a fixed number per event, or a table somewhere? │  
 │ event │ sales chart │ │
├─────────────────────┼────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤  
 │ Instagram follower │ Follower evolution chart │ Where does this come from? Instagram API, a manual export, a │  
 │ data │ │ third-party tool? │
├─────────────────────┼────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤  
 │ Referido code → │ Sales origin table │ How do you distinguish a paid media referral from a linktree one from a │  
 │ channel mapping │ (linktree vs paid vs │ mailing one? Is it a prefix convention in the Referido column, or │
│ │ mailing vs club) │ something in the UTM parameters? │  
 ├─────────────────────┼────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
│ "Ideal week" KPI │ Section II (last week vs │ Is this manually defined per event, or derived from historical │
│ curve │ ideal) │ averages? │  
 └─────────────────────┴────────────────────────────┴─────────────────────────────────────────────────────────────────────────┘

3. Information that may not be worth the screen space

- Instagram followers evolution — weekly follower count is noisy and hard to attribute to specific actions. Engagement rate per  
  post or story click-through rate would be more actionable, but that data likely doesn't live in BigQuery either. If you only have
  follower count, it's fine as a small KPI, not a full chart.
- "CURVA DESGLOSE POR TIPO DE CAMPAÑA del looker" — if this is a Looker chart you already have, duplicating it in a custom
  dashboard adds maintenance burden. Consider embedding it or replacing it only if the Looker version is inadequate.
- Referral Volume vs Engagement Quality (Sessions vs Engagement/Sessions) — this overlaps heavily with the funnel conversion rates
  by channel. I'd merge them into one view rather than having both.

Can you share the schema (or table name) for the paid media spend table in BigQuery? I need columns like: date, platform,  
 campaign, spend amount, impressions, clicks, etc.  
Can you share the event classification table schema and the Referido prefix mapping? E.g. FF = club, ref_lt = linktree, etc.
