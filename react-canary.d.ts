// Activa los tipos del canal `canary` de React en todo el proyecto. Es lo que
// expone el componente experimental `<ViewTransition>` (y `share`/`enter`/`exit`)
// en el módulo "react", habilitado en runtime vía `experimental.viewTransition`
// en next.config.ts. Una sola referencia en cualquier .d.ts del proyecto basta.
/// <reference types="react/canary" />
