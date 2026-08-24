# Widget Configuration remains live while Wallet Topology is fixed at bootstrap

Normalized Widget Configuration remains live during an Application Runtime
Generation, while Wallet Bootstrap captures connector mode, provider presence,
and connector-construction policy as fixed Wallet Topology. This supports normal
host updates without rebuilding wallet infrastructure from mixed-era inputs;
topology changes require a remount.
