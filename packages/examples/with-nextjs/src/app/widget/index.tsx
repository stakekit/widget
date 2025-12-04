"use client";

import dynamic from "next/dynamic";

export default dynamic(() => import("./widget").then((mod) => mod.Widget), {
  ssr: false,
});
