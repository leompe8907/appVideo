/**
 * Configuración COMPLETA y explícita de la marca `gigmax` -- todos los
 * parámetros del shape documentado en `../brands.js`, sin depender de
 * `./defaults.js` en tiempo de ejecución (ese archivo queda solo como
 * referencia/plantilla de valores típicos para crear una marca nueva).
 */
export default {
  "brand": "gigmax",
  "appName": "Gigmax",
  "os": "HTML5",
  "appVersion": "1",
  "branding": "Panaccess",
  "developedBy": "Gigmax",
  "version": "2.0.3",
  "login": {
    "theme": {
      "cardBackground": "rgba(255, 255, 255, 0.05)",
      "submitBg": "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",
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
      "enabled": false,
      "assetPath": "backgroundalt.webp"
    },
    "qrRegister": {
      "enabled": false,
      "url": "https://shop.fotelka.tv/?c=customer&p=register"
    },
    "forgotPassword": {
      "enabled": false,
      "url": ""
    },
    "udid": {
      "enabled": false,
      "baseUrl": "",
      "requestPath": "",
      "wsUrl": "",
      "appType": "10foot",
      "appVersion": "1.0",
      "maxReconnectAttempts": 3,
      "reconnectMs": [
        3000,
        6000,
        10000
      ],
      "heartbeatMs": 30000,
      "privateKeyUrl": ""
    },
    "socialLogin": {
      "backendBaseUrl": "http://127.0.0.1:8000",
      "google": {
        "enabled": false,
        "redirectUrl": "/wind/auth/google/",
        "accessToken": "803252352997-o8lj65s1h9ga2he9hu02vbflc4h749hv.apps.googleusercontent.com",
        "preferCustomButton": true,
        "backendBaseUrl": ""
      },
      "facebook": {
        "enabled": false,
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
    "epgPagesPastEnabled": true,
    "epgCardsChannelActiveBg": "#0A4385",
    "epgCardsHeaderBg": "rgb(0 0 0)",
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
    "channelChangeWithArrows": true
  },
  "ui": {
    "splashDuration": 3000,
    "splashAnimado": false,
    "focus": {
      "enabled": true,
      "color": "#FF6B35",
      "scale": 1.05,
      "ring": "0 0 0 4px rgba(var(--primary-color-rgb, 102, 126, 234), 0.7)",
      "ring2": "0 0 0 8px rgba(var(--primary-color-rgb, 102, 126, 234), 0.35)",
      "shadow": "0 12px 30px rgba(var(--primary-color-rgb, 102, 126, 234), 0.55)"
    },
    "epgLineColorTime": "#2CE308",
    "primaryColor": "#FF6B35",
    "secondaryColor": "#cc5528",
    "theme": "dark",
    "fontFamily": "Montserrat, sans-serif",
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
        "bg": "#2a2018",
        "text": "#ffffff"
      },
      "input": {
        "bg": "transparent",
        "text": "#ffffff",
        "placeholder": "rgba(255, 255, 255, 0.45)",
        "focusedBg": "rgba(255, 107, 53, 0.12)",
        "focusedBorder": "#FF6B35",
        "focusedShadow": "0 0 0 2px rgba(255, 107, 53, 0.4)"
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
        "activeBg": "#FF6B35",
        "activeText": "#ffffff",
        "activeHoverBg": "#cc5528"
      },
      "results": {
        "areaBg": "#1a1410",
        "cardBg": "#2a2018",
        "cardBorder": "#4a3528",
        "cardHoverBg": "#3d2e22",
        "cardFocusBorder": "#FF6B35",
        "titleText": "#ffffff",
        "metaText": "rgba(255, 255, 255, 0.65)",
        "sectionTitleBg": "rgba(255, 107, 53, 0.1)",
        "thumbBg": "rgba(255, 255, 255, 0.06)"
      },
      "empty": {
        "text": "rgba(255, 255, 255, 0.75)",
        "countText": "rgba(255, 255, 255, 0.65)"
      }
    }
  },
  "bouquets": {
    "timeshipColor": "#2CE308"
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
      "pc": false,
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
        "pc": false,
        "tv": true
      },
      "enabled": false,
      "areas": {
        "left": {
          "enabled": true,
          "showServiceInfo": false,
          "contentAlign": "left"
        },
        "center": {
          "enabled": true,
          "showServiceInfo": true,
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
    "showRating": false,
    "osms": false,
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
