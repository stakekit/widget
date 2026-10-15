# Widget Configuration remains live while Wallet Topology is fixed at bootstrap

Normalized Widget Configuration remains live during an Application Runtime
Generation, while Wallet Bootstrap captures connector mode, provider presence,
and connector-construction policy as fixed Wallet Topology. This supports normal
host updates without rebuilding wallet infrastructure from mixed-era inputs;
topology changes require a remount.

The Application API Identity (API key, base, Yields and Borrow API URLs) and
Borrow enablement are also fixed, at mount: API transports, Borrow sources and
operations, and the initial route read them once for the Application Runtime
Generation. When a Widget Configuration update changes any of them, the Widget
Configuration service publishes the mount values for those fields, applies the
rest of the update, and logs one warning naming the changed keys. The Wallet
Topology warning stays in wallet synchronization, whose reference point is
Wallet Bootstrap rather than mount. Changing these settings requires a remount.

React composition supplies Host Configuration and other initialization values,
but does not carry Effect Layers. Application-owned Atom runtimes compose their
`layer` Atoms. The private Wallet Connector Source runtime provides the
production adapter by default, while tests may replace that runtime Layer when
the Atom registry is created. The selected Layer remains fixed for the
Application Runtime Generation.

Runtime Layers share one registry-scoped memo map. Services are shared across
the application runtime graph within one generation, finalized when its
registry is disposed, and reconstructed for a later Widget Instance.
