# One Widget Instance per browser document

The Widget is designed and tested for a single mounted instance per browser
document. Multiple concurrent instances are not officially supported because
document-global wallet discovery, translation, styling, and host integrations
can conflict.

Runtime claims that previously blocked concurrent mounting have been removed,
allowing embedding hosts to mount multiple instances at their own discretion.
