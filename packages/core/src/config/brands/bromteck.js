/**
 * Configuración COMPLETA y explícita de la marca `bromteck` -- todos los
 * parámetros del shape documentado en `../brands.js`, sin depender de
 * `./defaults.js` en tiempo de ejecución (ese archivo queda solo como
 * referencia/plantilla de valores típicos para crear una marca nueva).
 */
export default {
  "brand": "bromteck",
  "appName": "Bromteck",
  "os": "HTML5",
  "appVersion": "1",
  "branding": "Panaccess",
  "developedBy": "Network Broadcast",
  "version": "1.0.2",
  "login": {
    "theme": {
      "cardBackground": "rgba(255, 255, 255, 0.05)",
      "submitBg": "#004c77",
      "submitText": "#ffffff",
      "registerBg": "rgba(255, 255, 255, 0.12)",
      "registerText": "#ffffff",
      "udidBg": "rgba(255, 255, 255, 0.12)",
      "udidText": "#ffffff",
      "toggleBg": "rgba(255, 255, 255, 0.1)",
      "toggleText": "rgba(255, 255, 255, 0.7)",
      "inputs": {
        "bg": "rgba(255, 255, 255, 0.1)",
        "border": "rgba(255, 255, 255, 0.2)",
        "text": "#ffffff",
        "placeholder": "rgba(255, 255, 255, 0.4)",
        "focusedBg": "rgba(255, 255, 255, 0.15)",
        "focusedBorder": null,
        "focusedShadow": null
      },
      "social": {
        "bg": "rgba(255, 255, 255, 0.08)",
        "border": "rgba(255, 255, 255, 0.22)",
        "text": "rgba(255, 255, 255, 0.92)"
      },
      "modalCloseBg": "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",
      "modalCloseText": "#ffffff",
      "linkColor": null,
      "dividerColor": "rgba(255, 255, 255, 0.25)",
      "forgotPasswordModal": {
        "background": "#141414",
        "borderColor": "rgba(255, 255, 255, 0.16)",
        "titleColor": "#ffffff",
        "textColor": "rgba(255, 255, 255, 0.82)",
        "iconBg": "rgba(var(--primary-color-rgb, 102, 126, 234), 0.16)",
        "iconColor": "var(--primary-color, #667eea)",
        "successIconBg": "rgba(99, 153, 34, 0.18)",
        "successIconColor": "#97c459",
        "inputIconColor": "rgba(255, 255, 255, 0.4)"
      }
    },
    "backgroundImage": {
      "enabled": true,
      "assetPath": "backgroundalt.webp"
    },
    "qrRegister": {
      "enabled": true,
      "url": "https://shop.fotelka.tv/?c=customer&p=register"
    },
    "forgotPassword": {
      "enabled": true,
      "url": "https://shop.fotelka.tv/?c=customer&p=reset_password"
    },
    "udid": {
      "enabled": true,
      "baseUrl": "http://127.0.0.1:8001",
      "requestPath": "/udid/request-udid-manual/",
      "wsUrl": "ws://127.0.0.1:8001/ws/auth/",
      "appType": "web",
      "appVersion": "1.0",
      "maxReconnectAttempts": 3,
      "reconnectMs": [
        3000,
        6000,
        10000
      ],
      "heartbeatMs": 30000,
      "privateKeyUrl": "/cableatlantico/keys/private_key.pem",
      "tempTokenRequired": true
    },
    "socialLogin": {
      "backendBaseUrl": "https://backend.wind.do",
      "google": {
        "enabled": true,
        "redirectUrl": "/wind/auth/google/",
        "accessToken": "487078023200-686hite4p619jtaobfa4oksvhoal7qc1.apps.googleusercontent.com",
        "preferCustomButton": true,
        "backendBaseUrl": ""
      },
      "facebook": {
        "enabled": true,
        "redirectUrl": "/wind/auth/facebook/",
        "accessToken": "823584907447149",
        "backendBaseUrl": ""
      }
    },
    "deviceSession": {
      "enabled": false,
      "baseUrl": "",
      "wsUrl": "",
      "changePasswordFlow": "otp"
    },
    "telemetry": {
      "enabled": false,
      "baseUrl": ""
    }
  },
  "account": {
    "theme": {
      "sidebarBg": "#0b2a4a",
      "contentBg": "#061a2e",
      "panelBg": "#0b2a4a",
      "panelText": "rgba(255, 255, 255, 0.88)",
      "activeItemBg": "#5c8fc4",
      "activeItemText": "#ffffff",
      "dividerColor": "rgba(255, 255, 255, 0.18)",
      "contentTitleColor": "#8fb9e8",
      "qrBackground": "#9dc3ec",
      "stepNumberBg": "#12365c",
      "stepNumberText": "#ffffff",
      "dangerText": "#ff8080"
    },
    "links": {
      "changePassword": {
        "enabled": true,
        "url": "https://shop.fotelka.tv/?c=customer&p=reset_password"
      },
      "linkedDevices": {
        "enabled": true,
        "url": "https://shop.fotelka.tv/?c=customer&p=devices"
      },
      "subscription": {
        "enabled": true,
        "url": "https://shop.fotelka.tv/?c=customer&p=subscription"
      },
      "deleteAccount": {
        "enabled": true,
        "url": "https://shop.fotelka.tv/?c=customer&p=delete_account"
      }
    },
    "sections": {
      "parentalControl": true,
      "about": true,
      "refresh": true,
      "logout": true,
      "exitApp": true
    }
  },
  "EPG": {
    "enabled": true,
    "daysOffset": 2,
    "hoursLimit": 12,
    "epgLineColorTime": "#2CE308",
    "reminderLeadSeconds": 60,
    "reminderShowWhilePlaying": false,
    "epgPast": true,
    "epgPagesPastEnabled": false,
    "epgCardsChannelActiveBg": "#0A4385",
    "epgCardsHeaderBg": "#5880afff",
    "epgCardsProgramLiveBg": "#6C8EB6",
    "epgCardsProgramLiveProgressBg": "#6C8EB6",
    "epgCardsLaterGlobal": true,
    "epgCloseModalOnPlayLive": "auto"
  },
  "catchup": {
    "enabled": true,
    "ui": {
      "activeLayout": "rails",
      "showAllLayouts": false
    },
    "layouts": {
      "legacy": {
        "enabled": true
      },
      "rails": {
        "enabled": true
      }
    }
  },
  "player": {
    "nativeAdaptersEnabled": false,
    "enginePolicy": "auto",
    "telemetryEnabled": true,
    "hudAutoHideMs": 6000,
    "inactivityTestTimeoutSec": 0,
    "inactivityGraceSec": 60,
    "screensaverRotateMs": 9000,
    "showPlaybackButtonsOnLive": false,
    "showSeekbarOnLive": false,
    "closeChannelSidebarOnSelect": false,
    "channelChangeWithArrows": false
  },
  "ui": {
    "splashDuration": 8000,
    "splashAnimado": true,
    "splashVideo": "splash.mp4",
    "focus": {
      "enabled": true,
      "color": "#004c77",
      "scale": 1.05,
      "ring": "0 0 0 4px rgba(var(--primary-color-rgb, 102, 126, 234), 0.7)",
      "ring2": "0 0 0 8px rgba(var(--primary-color-rgb, 102, 126, 234), 0.35)",
      "shadow": "0 12px 30px rgba(var(--primary-color-rgb, 102, 126, 234), 0.55)"
    },
    "epgLineColorTime": "#004c77",
    "primaryColor": "#004c77",
    "secondaryColor": "#004c77",
    "theme": "dark",
    "fontFamily": "Arial, sans-serif",
    "playerLoading": {
      "premium": true
    },
    "sidebar": {
      "backgroundColor": "rgba(0, 0, 0, 0.45)",
      "textColor": "rgba(255, 255, 255, 0.82)",
      "submenuBackgroundColor": "rgba(0, 0, 0, 0.55)",
      "submenuTextColor": "rgba(255, 255, 255, 0.85)",
      "fixed": true
    },
    "search": {
      "overlayBg": "rgba(0, 0, 0, 0.55)",
      "panelBg": "rgba(0, 0, 0, 0.92)",
      "header": {
        "bg": "#1a3a4a",
        "text": "#ffffff"
      },
      "input": {
        "bg": "transparent",
        "text": "#ffffff",
        "placeholder": "rgba(255, 255, 255, 0.45)",
        "focusedBg": "rgba(255, 255, 255, 0.08)",
        "focusedBorder": "#004c77",
        "focusedShadow": "0 0 0 2px rgba(0, 76, 119, 0.45)"
      },
      "clearButton": {
        "bg": "#c0392b",
        "text": "#ffffff",
        "hoverBg": "#e74c3c"
      },
      "tabs": {
        "bg": "rgba(255, 255, 255, 0.08)",
        "text": "rgba(255, 255, 255, 0.9)",
        "hoverBg": "rgba(255, 255, 255, 0.18)",
        "activeBg": "#004c77",
        "activeText": "#ffffff",
        "activeHoverBg": "#003a5c"
      },
      "results": {
        "areaBg": "#141f26",
        "cardBg": "#1a3a4a",
        "cardBorder": "#2a5568",
        "cardHoverBg": "#254a5c",
        "cardFocusBorder": "#004c77",
        "titleText": "#ffffff",
        "metaText": "rgba(255, 255, 255, 0.65)",
        "sectionTitleBg": "rgba(255, 255, 255, 0.06)",
        "thumbBg": "rgba(255, 255, 255, 0.06)"
      },
      "empty": {
        "text": "rgba(255, 255, 255, 0.75)",
        "countText": "rgba(255, 255, 255, 0.65)"
      }
    }
  },
  "bouquets": {
    "timeshipColor": "#EE8834"
  },
  "layout": {
    "shell": {
      "pc": "sidebar",
      "tv": "sidebar"
    },
    "topbar": {
      "areas": {
        "left": {
          "content": "logo"
        },
        "center": {
          "content": "nav"
        },
        "right": {
          "content": "account"
        }
      }
    },
    "navOrder": [
      "search",
      "inicio",
      "channels",
      "vod",
      "epg",
      "catchup"
    ]
  },
  "header": {
    "activado": {
      "pc": true,
      "tv": true
    },
    "areas": {
      "left": {
        "enabled": true,
        "showLogo": true,
        "showTime": false,
        "contentAlign": "left"
      },
      "center": {
        "enabled": true,
        "showLogo": false,
        "showTime": false,
        "contentAlign": "center"
      },
      "right": {
        "enabled": true,
        "showLogo": false,
        "showTime": true,
        "contentAlign": "right"
      }
    },
    "subheader": {
      "activado": {
        "pc": true,
        "tv": true
      },
      "enabled": true,
      "areas": {
        "left": {
          "enabled": true,
          "showServiceInfo": true,
          "contentAlign": "left"
        },
        "center": {
          "enabled": true,
          "showServiceInfo": false,
          "contentAlign": "center"
        },
        "right": {
          "enabled": true,
          "showServiceInfo": false,
          "contentAlign": "right"
        }
      }
    }
  },
  "homeShell": {
    "header": {
      "inicio": true,
      "serviciosTvRadio": true,
      "vod": true,
      "catchup": true
    },
    "ads": {
      "inicio": true,
      "serviciosTvRadio": false,
      "vod": false,
      "catchup": false,
      "topInBouquets": false
    }
  },
  "features": {
    "profiles": false,
    "showRating": true,
    "osms": true,
    "osmsInline": true,
    "playerVolumeControls": false,
    "playerChannelArrows": false
  },
  "vod": {
    "layout": "hero",
    "add": true,
    "vodDetail": {
      "descriptionMaxLength": 180,
      "showReleaseYear": true,
      "showDuration": true,
      "showParentalRating": true,
      "showCategories": true,
      "showStarRating": true,
      "showDescription": true,
      "playButtonColor": null,
      "starRatingColor": null,
      "heroGradientOpacity": 0.95,
      "posterWidthMin": 100,
      "posterWidthMax": 200,
      "categoryTagBackground": "rgba(255, 255, 255, 0.12)",
      "categoryTagBorderColor": "rgba(255, 255, 255, 0.2)",
      "parentalBadgeBorderColor": "rgba(255, 255, 255, 0.5)",
      "contentPosition": "bottom"
    }
  },
  "hashPasswordBeforeLogin": true,
  "debug": {
    "spatialNav": false,
    "spatialNavVisual": false
  }
};
