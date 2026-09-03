# One Widget Instance per browser document

The Widget supports at most one concurrently mounted Widget Instance in a
browser document; unmounting and later mounting another instance is supported.
Document-global wallet discovery, translation, and host integrations make safe
concurrent isolation disproportionately complex.
