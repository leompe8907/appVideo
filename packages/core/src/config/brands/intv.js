/**
 * Configuración COMPLETA y explícita de la marca `intv` -- todos los
 * parámetros del shape documentado en `../brands.js`, sin depender de
 * `./defaults.js` en tiempo de ejecución (ese archivo queda solo como
 * referencia/plantilla de valores típicos para crear una marca nueva).
 */
export default {
  "brand": "intv",
  "appName": "inTV Play",
  "os": "HTML5",
  "appVersion": "1",
  "branding": "Panaccess",
  "developedBy": "inTV&#174,",
  "version": "2.0.2",
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
        "background": "rgba(22, 32, 45, 0.96))",
        "borderColor": "rgba(12, 1, 104, 0.97)",
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
      "url": ""
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
      "appType": "",
      "appVersion": "",
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
      "enabled": true,
      "baseUrl": "https://backend.wind.do/",
      "wsUrl": "wss://backend.wind.do/ws/device/",
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
        "url": "https://backend.wind.do/wind/login/"
      },
      "linkedDevices": {
        "enabled": true,
        "url": ""
      },
      "subscription": {
        "enabled": true,
        "url": ""
      },
      "deleteAccount": {
        "enabled": true,
        "url": ""
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
    "enabled": false,
    "daysOffset": 2,
    "hoursLimit": 12,
    "epgLineColorTime": "#3333FF",
    "reminderLeadSeconds": 60,
    "reminderShowWhilePlaying": false,
    "epgPast": true,
    "epgPagesPastEnabled": true,
    "epgCardsChannelActiveBg": "#0A2135",
    "epgCardsHeaderBg": "#0A2135",
    "epgCardsProgramLiveBg": "#415463",
    "epgCardsProgramLiveProgressBg": "#3B9FAC",
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
      "color": "#3355FF",
      "scale": 1.05,
      "ring": "0 0 0 4px rgba(var(--primary-color-rgb, 102, 126, 234), 0.7)",
      "ring2": "0 0 0 8px rgba(var(--primary-color-rgb, 102, 126, 234), 0.35)",
      "shadow": "0 12px 30px rgba(var(--primary-color-rgb, 102, 126, 234), 0.55)"
    },
    "epgLineColorTime": "#3333FF",
    "primaryColor": "#011266ff",
    "secondaryColor": "#0023d0ff",
    "theme": "light",
    "fontFamily": "Roboto, sans-serif",
    "playerLoading": {
      "premium": true
    },
    "sidebar": {
      "backgroundColor": "rgb(0, 4, 253)",
      "textColor": "rgba(255, 255, 255, 0.82)",
      "submenuBackgroundColor": "rgb(0, 0, 0)",
      "submenuTextColor": "rgba(255, 255, 255, 0.85)",
      "fixed": true
    },
    "search": {
      "overlayBg": "rgba(0, 0, 0, 0.35)",
      "panelBg": "rgba(248, 249, 255, 0.98)",
      "header": {
        "bg": "#e8ebff",
        "text": "#1a1a2e"
      },
      "input": {
        "bg": "rgba(255, 255, 255, 0.85)",
        "text": "#1a1a2e",
        "placeholder": "rgba(26, 26, 46, 0.45)",
        "focusedBg": "#ffffff",
        "focusedBorder": "#3355FF",
        "focusedShadow": "0 0 0 2px rgba(51, 85, 255, 0.35)"
      },
      "clearButton": {
        "bg": "#dc3545",
        "text": "#ffffff",
        "hoverBg": "#c82333"
      },
      "tabs": {
        "bg": "rgba(51, 85, 255, 0.1)",
        "text": "rgba(26, 26, 46, 0.85)",
        "hoverBg": "rgba(51, 85, 255, 0.18)",
        "activeBg": "#3355FF",
        "activeText": "#ffffff",
        "activeHoverBg": "#2244dd"
      },
      "results": {
        "areaBg": "#eceef8",
        "cardBg": "#ffffff",
        "cardBorder": "#d0d5f0",
        "cardHoverBg": "#f0f2ff",
        "cardFocusBorder": "#3355FF",
        "titleText": "#1a1a2e",
        "metaText": "rgba(26, 26, 46, 0.65)",
        "sectionTitleBg": "rgba(51, 85, 255, 0.08)",
        "thumbBg": "rgba(51, 85, 255, 0.06)"
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
      "pc": "topbar",
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
      "inicio",
      "channels",
      "epg",
      "search",
      "vod",
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
        "enabled": false,
        "showLogo": false,
        "showTime": false,
        "contentAlign": "left"
      },
      "center": {
        "enabled": false,
        "showLogo": false,
        "showTime": false,
        "contentAlign": "center"
      },
      "right": {
        "enabled": false,
        "showLogo": false,
        "showTime": false,
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
          "enabled": false,
          "showServiceInfo": true,
          "contentAlign": "left"
        },
        "center": {
          "enabled": false,
          "showServiceInfo": false,
          "contentAlign": "right"
        },
        "right": {
          "enabled": false,
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
    "osms": false,
    "osmsInline": true,
    "playerVolumeControls": true,
    "playerChannelArrows": true
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
      "heroGradientOpacity": 1,
      "posterWidthMin": 100,
      "posterWidthMax": 200,
      "categoryTagBackground": "rgba(255, 255, 255, 0.12)",
      "categoryTagBorderColor": "rgba(255, 255, 255, 0.2)",
      "parentalBadgeBorderColor": "rgba(255, 255, 255, 0.5)",
      "contentPosition": "bottom"
    }
  },
  "hashPasswordBeforeLogin": false,
  "debug": {
    "spatialNav": false,
    "spatialNavVisual": false
  }
};
