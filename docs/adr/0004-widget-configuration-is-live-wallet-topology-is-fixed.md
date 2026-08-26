# Widget Configuration remains live while Wallet Topology is fixed at bootstrap

Normalized Widget Configuration remains live during an Application Runtime
Generation, while Wallet Bootstrap captures connector mode, provider presence,
and connector-construction policy as fixed Wallet Topology. This supports normal
host updates without rebuilding wallet infrastructure from mixed-era inputs;
topology changes require a remount.

React composition supplies Host Configuration and other initialization values,
but does not carry Effect Layers. Application-owned Atom runtimes compose their
`layer` Atoms. The private Wallet Connector Source runtime provides the
production adapter by default, while tests may replace that runtime Layer when
the Atom registry is created. The selected Layer remains fixed for the
Application Runtime Generation.

Runtime Layers share one registry-scoped memo map. Services are shared across
the application runtime graph within one generation, finalized when its
registry is disposed, and reconstructed for a later Widget Instance.
