export const BRANDS = [
  {
    brand: "bromteck",
    appName: "Bromteck",
    drm: "https://cv10.panaccess.com/",
    token: "CUZwaXeVxOvrCiMmVHov",
    logoPositionHome: "top",
    showTime: true,
    epgLineColorTime: "#2CE308",
    developedBy: "Network Broadcast",
    version: "1.0.2",
  },
  {
    brand: "intv",
    appName: "inTV Play",
    drm: "https://pmdw-1.in.tv.br/",
    token: "CQSepFFsoFNgyLNDYOpz",
    logoPositionHome: "right",
    showTime: false,
    epgLineColorTime: "#3333FF",
    developedBy: "inTV&#174,",
    version: "2.0.2",
    miniPlayerEnabled: true,
  },
  {
    brand: "gigmax",
    appName: "Gigmax",
    drm: "https://cv10.panaccess.com/",
    token: "NLdLsrJkgIgnxMIDurSI",
    logoPositionHome: "right",
    showTime: true,
    epgLineColorTime: "#2CE308",
    developedBy: "Gigmax",
    version: "2.0.3",
  },
];

export function getBrandConfig(brandName) {
  const brand = BRANDS.find(b => b.brand === brandName);
  return brand || null;
}

