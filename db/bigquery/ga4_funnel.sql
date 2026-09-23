WITH base AS (
  SELECT
    property_id,
    date,
    funnel_step,
    step_order,
    landing_page,
    total_users,
    ingested_at,
    LOWER(REGEXP_REPLACE(landing_page, r'\.html$', '')) AS lp
  FROM `root-emissary-313321.google_analytics.funnel`
  WHERE landing_page NOT LIKE '/pruebasgt%'
)
SELECT
  property_id,
  date,
  funnel_step,
  step_order,
  landing_page AS landing_page_raw,
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
      THEN CONCAT('/codigo/', COALESCE(REGEXP_EXTRACT(landing_page, r'/(GL[A-Z]\d+)'), 'otros'), '/*')
    WHEN lp LIKE '/ref/%'
      THEN CONCAT('/ref/', COALESCE(REGEXP_EXTRACT(landing_page, r'/(GL[A-Z]\d+)'), 'otros'), '/*')
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
  total_users,
  ingested_at
FROM base
