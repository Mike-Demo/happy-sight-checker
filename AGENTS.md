# Architecture rules

- Preview message handlers must validate both the parent window and the exact origin using the shared preview-origin policy; generated routes and HTML must use the same policy to prevent regeneration from undoing security fixes.