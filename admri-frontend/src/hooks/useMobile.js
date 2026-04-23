// src/hooks/useMobile.js
import { useState, useEffect } from "react";

export function useMobile() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler, { passive:true });
    return () => window.removeEventListener("resize", handler);
  }, []);

  const isMobile  = width < 640;
  const isTablet  = width >= 640 && width < 1024;
  const isDesktop = width >= 1024;

  // Responsive grid columns helper
  function cols(desktop, tablet, mobile = 1) {
    if (isMobile)  return mobile;
    if (isTablet)  return tablet ?? desktop;
    return desktop;
  }

  // Responsive grid template string
  function gridCols(desktop, tablet, mobile = 1) {
    const c = cols(desktop, tablet, mobile);
    return `repeat(${c}, 1fr)`;
  }

  // Sidebar width — 0 on mobile (drawer), 200 tablet, 236 desktop
  const sidebarWidth = isMobile ? 0 : isTablet ? 200 : 236;

  // Content padding
  const pagePadding = isMobile ? "12px 14px" : isTablet ? "18px 20px" : "24px 28px";

  // Font scaling
  const fontSize = {
    hero:  isMobile ? 22 : 28,
    title: isMobile ? 16 : 20,
    body:  13,
    small: 11,
  };

  return {
    width, isMobile, isTablet, isDesktop,
    cols, gridCols,
    sidebarWidth, pagePadding, fontSize,
  };
}
