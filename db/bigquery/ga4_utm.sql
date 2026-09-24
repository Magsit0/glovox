WITH base AS (
  SELECT
    *,
    LOWER(TRIM(COALESCE(source, ''))) AS src,
    LOWER(TRIM(COALESCE(medium, ''))) AS med,
    LOWER(REGEXP_REPLACE(landing_page, r'\.html$', '')) AS lp
  FROM `root-emissary-313321.google_analytics.utm`
  WHERE landing_page NOT LIKE '/pruebasgt%'
)
SELECT
  property_id,
  date,
  source,
  medium,
  campaign,
  content,
  term,
  CASE
    WHEN src = '(direct)' AND med = '(none)' THEN 'Directo'
    WHEN src = '(not set)' OR med = '(not set)' THEN '(not set)'
    WHEN src = '' OR med = '' THEN 'Sin dato'
    WHEN src = '(other)' OR med = '(other)' THEN 'Sin clasificar (other)'
    WHEN REGEXP_CONTAINS(src, r'webpay|transbank|getnet|khipu|mercadopago|flow\.cl')
      THEN 'Pasarela de pago'
    WHEN src LIKE 'comunidad%' THEN 'Comunidad (referidos)'
    WHEN src = 'ff' THEN 'Vendedores (ref)'
    WHEN src LIKE 'meta%' OR src IN ('mt', 'fb', 'facebook', 'facebook-instagram')
      OR (src = 'ig' AND med IN ('paid', 'pm', 'paid_media', 'paid.social'))
      THEN 'Meta (pagado)'
    WHEN src IN ('gg', 'googleads', 'google ads')
      OR (src = 'google' AND med IN ('cpc', 'pm', 'paid', 'ppc', 'paid_media'))
      THEN 'Google Ads (pagado)'
    WHEN REGEXP_CONTAINS(src, r'programmatic|dv360') OR med = 'display'
      THEN 'Display / YouTube (pagado)'
    WHEN src = 'tiktok' AND med IN ('paid', 'pm', 'cpc') THEN 'TikTok (pagado)'
    WHEN src IN ('google', 'bing', 'duckduckgo', 'yahoo', 'ecosia')
      THEN 'Búsqueda orgánica'
    WHEN src IN ('linktr.ee', 'linktree', 'lt') THEN 'Linktree'
    WHEN REGEXP_CONTAINS(src, r'piknicelectronik|glovox|thegrid|grid|sundeck')
      AND med = 'referral' THEN 'Sitio propio'
    WHEN REGEXP_CONTAINS(src, r'instagram|facebook|tiktok|youtube|twitter|t\.co')
      OR src IN ('ig', 'sto', 'snapchat') THEN 'Social orgánico'
    WHEN REGEXP_CONTAINS(med, r'email|mail') OR REGEXP_CONTAINS(src, r'mailchimp|drip|klaviyo')
      THEN 'Email'
    WHEN med = 'referral' THEN 'Otros referrals'
    ELSE 'Otro'
  END AS canal,
  CASE
    WHEN lp LIKE '/codigo/%' THEN 'codigo_personal'
    WHEN lp LIKE '/ref/%' THEN 'link_referido'
    WHEN lp LIKE '/compra/exito%' OR lp LIKE '/compra/fallo%' THEN 'retorno_pago'
    WHEN REGEXP_CONTAINS(lp, r'^/purchase/\d+(?:/|[?#]|$)') THEN 'checkout_interno'
    WHEN lp LIKE '/compra/%' OR lp LIKE '/account/%'
      OR lp LIKE '/producto/%' OR lp LIKE '/tickets/%' THEN 'checkout_interno'
    WHEN landing_page IN ('(not set)', '(other)', '') THEN 'sin_dato'
    ELSE 'pagina_evento'
  END AS familia,
  COALESCE(
    UPPER(REGEXP_EXTRACT(landing_page, r'(?i)/(gl[a-z]\d+)(?:/|[?#]|$)')),
    REGEXP_EXTRACT(landing_page, r'(?i)/(?:m|purchase)/(\d+)(?:/|[?#]|$)')
  ) AS evento_id_url,
  CASE
    WHEN lp LIKE '/codigo/%'
      THEN CONCAT('/codigo/', COALESCE(UPPER(REGEXP_EXTRACT(landing_page, r'(?i)/(gl[a-z]\d+)')), 'otros'), '/*')
    WHEN lp LIKE '/ref/%'
      THEN CONCAT('/ref/', COALESCE(UPPER(REGEXP_EXTRACT(landing_page, r'(?i)/(gl[a-z]\d+)')), 'otros'), '/*')
    WHEN REGEXP_CONTAINS(lp, r'^/m/\d+(?:/|[?#]|$)')
      THEN CONCAT('/m/', REGEXP_EXTRACT(lp, r'^/m/(\d+)'))
    WHEN REGEXP_CONTAINS(lp, r'^/purchase/\d+(?:/|[?#]|$)')
      THEN CONCAT('/purchase/', REGEXP_EXTRACT(lp, r'^/purchase/(\d+)'), '/*')
    WHEN lp LIKE '/compra/exito%' THEN '/compra/exito/*'
    WHEN lp LIKE '/compra/fallo%' THEN '/compra/fallo/*'
    WHEN lp LIKE '/tickets/%' THEN '/tickets/*'
    WHEN landing_page IN ('(not set)', '(other)', '') THEN '(sin dato)'
    ELSE lp
  END AS landing_normalizada,
  landing_page AS landing_page_raw,
  screen_page_views,
  sessions,
  bounce_rate,
  total_users,
  event_count,
  ingested_at
FROM base
