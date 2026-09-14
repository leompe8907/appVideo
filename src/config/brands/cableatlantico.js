/**
 * Configuración COMPLETA y explícita de la marca `cableatlantico` -- todos los
 * parámetros del shape documentado en `../brands.js`, sin depender de
 * `./defaults.js` en tiempo de ejecución (ese archivo queda solo como
 * referencia/plantilla de valores típicos para crear una marca nueva).
 */
export default {
  "brand": "cableatlantico",
  "appName": "delancertv",
  "os": "HTML5",
  "appVersion": "1",
  "branding": "Cabledelancer",
  "developedBy": "Cabledelancer",
  "version": "1.0.2",
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
      "enabled": true,
      "baseUrl": "http://127.0.0.1:8000",
      "requestPath": "/udid/request-udid-manual/",
      "wsUrl": "ws://127.0.0.1:8000/ws/auth/",
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
      "backendBaseUrl": "",
      "google": {
        "enabled": false,
        "redirectUrl": "",
        "accessToken": "",
        "preferCustomButton": true,
        "backendBaseUrl": ""
      },
      "facebook": {
        "enabled": false,
        "redirectUrl": "",
        "accessToken": "",
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
    "daysOffset": 3,
    "hoursLimit": 12,
    "epgLineColorTime": "#3333FF",
    "reminderLeadSeconds": 60,
    "reminderShowWhilePlaying": false,
    "epgPast": true,
    "epgPagesPastEnabled": true,
    "epgCardsChannelActiveBg": "rgb(0 0 0)",
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
      "color": "#3333FF",
      "scale": 1.05,
      "ring": "0 0 0 4px rgba(var(--primary-color-rgb, 102, 126, 234), 0.7)",
      "ring2": "0 0 0 8px rgba(var(--primary-color-rgb, 102, 126, 234), 0.35)",
      "shadow": "0 12px 30px rgba(var(--primary-color-rgb, 102, 126, 234), 0.55)"
    },
    "epgLineColorTime": "#3333FF",
    "primaryColor": "#3333FF",
    "secondaryColor": "#1a1aaa",
    "theme": "light",
    "fontFamily": "Roboto, sans-serif",
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
      "overlayBg": "rgba(0, 0, 0, 0.35)",
      "panelBg": "rgba(248, 248, 255, 0.98)",
      "header": {
        "bg": "#e8e8ff",
        "text": "#1a1a2e"
      },
      "input": {
        "bg": "rgba(255, 255, 255, 0.85)",
        "text": "#1a1a2e",
        "placeholder": "rgba(26, 26, 46, 0.45)",
        "focusedBg": "#ffffff",
        "focusedBorder": "#3333FF",
        "focusedShadow": "0 0 0 2px rgba(51, 51, 255, 0.35)"
      },
      "clearButton": {
        "bg": "#dc3545",
        "text": "#ffffff",
        "hoverBg": "#c82333"
      },
      "tabs": {
        "bg": "rgba(51, 51, 255, 0.1)",
        "text": "rgba(26, 26, 46, 0.85)",
        "hoverBg": "rgba(51, 51, 255, 0.18)",
        "activeBg": "#3333FF",
        "activeText": "#ffffff",
        "activeHoverBg": "#1a1aaa"
      },
      "results": {
        "areaBg": "#ececf5",
        "cardBg": "#ffffff",
        "cardBorder": "#d0d0f0",
        "cardHoverBg": "#f0f0ff",
        "cardFocusBorder": "#3333FF",
        "titleText": "#1a1a2e",
        "metaText": "rgba(26, 26, 46, 0.65)",
        "sectionTitleBg": "rgba(51, 51, 255, 0.08)",
        "thumbBg": "rgba(51, 51, 255, 0.06)"
      },
      "empty": {
        "text": "rgba(26, 26, 46, 0.75)",
        "countText": "rgba(26, 26, 46, 0.55)"
      }
    }
  },
  "bouquets": {
    "timeshipColor": "#3333FF"
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
      "contentPosition": "middle"
    }
  },
  "hashPasswordBeforeLogin": false,
  "debug": {
    "spatialNav": false,
    "spatialNavVisual": false
  }
};
