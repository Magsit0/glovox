WITH Tickets AS (

  SELECT
  
    EventoID,
    FORMAT_TIMESTAMP('%Y-%m-%d', FechaOrden) AS Fecha,
    COUNT(*) AS TicketsVendidos,
    COUNTIF(VentaComunidad IS TRUE) AS TicketsVendidosComunidad,
    SUM(COUNT(*)) OVER (PARTITION BY EventoID) AS TotalTicketsVendidos,
    SUM(COUNTIF(VentaComunidad IS TRUE)) OVER (PARTITION BY EventoID) AS TotalTicketsVendidosComunidad

  FROM `root-emissary-313321.glovox.tickets`

  WHERE CASE 
        WHEN MedioPago = 'Otro' AND (LOWER(TipoTicket) LIKE '%pase%' OR LOWER(TipoTicket) LIKE '%pass%') THEN 'PASE TEMPORADA'
        WHEN MedioPago = 'Otro' AND LOWER(TipoTicket) LIKE '%mesa%' THEN 'MESA VIP'
        WHEN MedioPago = 'Otro' THEN 'CORTESIA'
        ELSE 'VENTA'
  END IN ('VENTA', 'PASE TEMPORADA')
  AND EsDevuelto IS FALSE

  GROUP BY EventoID, Fecha

),

generalAds AS (

  SELECT
    EventoID,
    Campaign_Id,
    Campaign_Name,
    FORMAT_TIMESTAMP('%Y-%m-%d', Fecha) AS Fecha,
    Platform,
    Objective,
    CASE WHEN Account_Currency='CLP' THEN SUM(Spend)/900
  	ELSE SUM(Spend) END
  	AS Spend,
    SUM(Purchase) AS Purchase
  FROM `root-emissary-313321.paidMedia.generalAds`
  WHERE Spend > 0
  GROUP BY EventoID, Campaign_Id, Campaign_Name, Fecha, Platform, Objective, Account_Currency

),

PM_Period AS (
  SELECT
    EventoID,
    MIN(CAST(Fecha AS DATE)) AS FechaInicioPM,
    MAX(CAST(Fecha AS DATE)) AS FechaFinPM
  FROM generalAds
  GROUP BY EventoID
),

AllDates AS (

  SELECT DISTINCT EventoID, Fecha FROM Tickets
  UNION DISTINCT
  SELECT DISTINCT EventoID, Fecha FROM generalAds

),

EventObjectives AS (

  SELECT DISTINCT EventoID, Campaign_Id, Campaign_Name, Platform, Objective
  FROM generalAds

),

ExpandedDates AS (

  SELECT 
    d.EventoID,
    d.Fecha,
    eo.Campaign_Id,
    eo.Campaign_Name,
    eo.Platform,
    eo.Objective
  FROM AllDates d
  JOIN EventObjectives eo ON d.EventoID = eo.EventoID

),

Followers AS (
  SELECT
    blog_id,
    FORMAT_DATE('%Y-%m-%d', DATE(date)) AS Fecha,
    delta_followers,
    total_followers
  FROM `root-emissary-313321.marketing.rrssFollowers`
)

SELECT
  ed.EventoID,
  CONCAT(ed.EventoID,' - ', b.NombreGlovox) AS NombreID,
  b.CategoriaEvento,
  ed.Campaign_Id,
  ed.Campaign_Name,
  ed.Fecha,
  COALESCE(t.TicketsVendidos, 0) AS TicketsVendidos,
  COALESCE(t.TicketsVendidosComunidad, 0) AS TicketsVendidosComunidad,
  ed.Platform,
  ed.Objective,
  CASE WHEN ga.Platform IN ('Google','Tiktok') THEN COALESCE(ga.Spend, 0)
  ELSE COALESCE(ga.Spend, 0) END AS Spend,
  CASE WHEN ga.Platform IN ('Google','Tiktok') THEN COALESCE(ga.Purchase, 0)
  ELSE COALESCE(ga.Purchase, 0) END AS Purchase,
  #CAST(SUM(TicketsVendidos) OVER (PARTITION BY ed.EventoID, ed.Fecha) AS FLOAT64) AS TicketsAcum,
	
  t.TotalTicketsVendidos AS TicketsAcum,
  t.TotalTicketsVendidosComunidad AS TicketsAcumComunidad,
  SUM(Spend) OVER (PARTITION BY ed.EventoID) AS SpendAcum,

  f.total_followers AS Followers,
  f.delta_followers AS deltaFollowers,

  f_inicio.total_followers AS Followers_inicio_PM,
  f_fin.total_followers AS Followers_fin_PM,
  SAFE_SUBTRACT(f_fin.total_followers, f_inicio.total_followers) AS Growth_PM,

  b.budgetPm,
  b.goalTickets


FROM ExpandedDates ed
LEFT JOIN Tickets t
  ON ed.EventoID = t.EventoID AND ed.Fecha = t.Fecha

LEFT JOIN generalAds ga
  ON ed.EventoID = ga.EventoID 
  AND ed.Fecha = ga.Fecha
  AND ed.Campaign_Name = ga.Campaign_Name

LEFT JOIN `root-emissary-313321.glovox.categoriaEvento` b
ON ed.EventoID=b.EventoID

LEFT JOIN Followers f
  ON f.blog_id = b.CuentaIG
  AND f.Fecha = ed.Fecha

LEFT JOIN PM_Period pm
  ON ed.EventoID = pm.EventoID

LEFT JOIN Followers f_inicio
  ON f_inicio.blog_id = b.CuentaIG
  AND CAST(f_inicio.Fecha AS DATE) = pm.FechaInicioPM

LEFT JOIN Followers f_fin
  ON f_fin.blog_id = b.CuentaIG
  AND CAST(f_fin.Fecha AS DATE) = pm.FechaFinPM

ORDER BY ed.EventoID, ed.Fecha, ed.Campaign_Name
