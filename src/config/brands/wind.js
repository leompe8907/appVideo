/**
 * Configuración COMPLETA y explícita de la marca `wind` -- todos los
 * parámetros del shape documentado en `../brands.js`, sin depender de
 * `./defaults.js` en tiempo de ejecución (ese archivo queda solo como
 * referencia/plantilla de valores típicos para crear una marca nueva).
 */
export default {
  "brand": "wind",
  "appName": "WindTV",
  "os": "HTML5",
  "appVersion": "1",
  "branding": "Panaccess",
  "developedBy": "windplay",
  "version": "1.0.0",
  "login": {
    "theme": {
      "cardBackground": "rgba(22, 32, 45, 0.96)",
      "submitBg": "#99bbd3",
      "submitText": "#16202d",
      "registerBg": "rgba(255, 255, 255, 0.12)",
      "registerText": "#ffffff",
      "udidBg": "rgba(255, 255, 255, 0.12)",
      "udidText": "#ffffff",
      "toggleBg": "transparent",
      "toggleText": "rgba(255, 255, 255, 0.55)",
      "inputs": {
        "bg": "rgba(12, 18, 28, 0.85)",
        "border": "rgba(255, 255, 255, 0.85)",
        "text": "#ffffff",
        "placeholder": "rgba(255, 255, 255, 0.45)",
        "focusedBg": "rgba(12, 18, 28, 0.95)",
        "focusedBorder": "#99bbd3",
        "focusedShadow": null
      },
      "social": {
        "bg": "transparent",
        "border": "rgba(153, 187, 211, 0.65)",
        "text": "#ffffff"
      },
      "modalCloseBg": "linear-gradient(135deg, var(--primary-color, #667eea) 0%, var(--secondary-color, #764ba2) 100%)",
      "modalCloseText": "#ffffff",
      "linkColor": "#99bbd3",
      "dividerColor": "rgba(255, 255, 255, 0.25)",
      "forgotPasswordModal": {
        "background": "rgba(22, 32, 45, 0.96)",
        "borderColor": "rgb(38 34 67 / 97%)",
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
      "enabled": false,
      "url": "https://backend.wind.do/wind/register/"
    },
    "forgotPassword": {
      "enabled": true,
      "url": "https://backend.wind.do/wind/forgot-password/"
    },
    "udid": {
      "enabled": false,
      "baseUrl": "https://backend.wind.do",
      "requestPath": "/wind/request-udid-manual/",
      "wsUrl": "wss://backend.wind.do/ws/auth/",
      "appType": "10foot",
      "appVersion": "1.0",
      "maxReconnectAttempts": 3,
      "reconnectMs": [
        3000,
        6000,
        10000
      ],
      "heartbeatMs": 30000,
      "privateKeyUrl": "",
      "tempTokenRequired": true
    },
    "socialLogin": {
      "backendBaseUrl": "https://backend.wind.do",
      "google": {
        "enabled": false,
        "redirectUrl": "/wind/auth/google/",
        "accessToken": "487078023200-686hite4p619jtaobfa4oksvhoal7qc1.apps.googleusercontent.com",
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
      "enabled": true,
      "baseUrl": "https://backend.wind.do/",
      "wsUrl": "wss://backend.wind.do/ws/device/",
      "changePasswordFlow": "otp"
    },
    "telemetry": {
      "enabled": true,
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
      "contentTitleColor": "#ffffffff",
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
        "url": "https://backend.wind.do/wind/login/"
      },
      "subscription": {
        "enabled": false,
        "url": "https://backend.wind.do/wind/login/"
      },
      "deleteAccount": {
        "enabled": true,
        "url": "https://backend.wind.do/wind/login/"
      }
    },
    "sections": {
      "parentalControl": false,
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
    "epgLineColorTime": "#6c8eb6",
    "reminderLeadSeconds": 60,
    "reminderShowWhilePlaying": false,
    "epgPast": false,
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
    "splashDuration": 5000,
    "splashAnimado": true,
    "splashVideo": "splash.mp4",
    "focus": {
      "enabled": true,
      "color": "#3AA3AE",
      "scale": 1.05,
      "ring": "0 0 0 4px rgba(var(--primary-color-rgb, 102, 126, 234), 0.7)",
      "ring2": "0 0 0 8px rgba(var(--primary-color-rgb, 102, 126, 234), 0.35)",
      "shadow": "0 12px 30px rgba(var(--primary-color-rgb, 102, 126, 234), 0.55)"
    },
    "epgLineColorTime": "#3333FF",
    "primaryColor": "#3AA3AE",
    "secondaryColor": "#2C7F88",
    "theme": "dark",
    "fontFamily": "Roboto, sans-serif",
    "playerLoading": {
      "premium": true
    },
    "sidebar": {
      "backgroundColor": "#012B4F",
      "textColor": "rgba(255, 255, 255, 0.82)",
      "submenuBackgroundColor": "rgb(0, 0, 0)",
      "submenuTextColor": "rgba(255, 255, 255, 0.85)",
      "fixed": true
    },
    "search": {
      "overlayBg": "#00182D",
      "panelBg": "#012B4F",
      "header": {
        "bg": "#012B4F",
        "text": "#ffffff"
      },
      "input": {
        "bg": "transparent",
        "text": "#ffffff",
        "placeholder": "#ffffff",
        "focusedBg": "#012B4F",
        "focusedBorder": "#012B4F",
        "focusedShadow": "0 0 0 2px #3AA3AE"
      },
      "clearButton": {
        "bg": "#012B4F",
        "text": "#ffffff",
        "hoverBg": "#012B4F"
      },
      "tabs": {
        "bg": "#012B4F",
        "text": "#ffffff",
        "hoverBg": "#012B4F",
        "activeBg": "#3AA3AE",
        "activeText": "#ffffff",
        "activeHoverBg": "#012B4F"
      },
      "results": {
        "areaBg": "#012B4F",
        "cardBg": "#012B4F",
        "cardBorder": "#012B4F",
        "cardHoverBg": "#134a6b",
        "cardFocusBorder": "#012B4F",
        "titleText": "#ffffff",
        "metaText": "#ffffff",
        "sectionTitleBg": "#012B4F",
        "thumbBg": "#012B4F"
      },
      "empty": {
        "text": "rgba(255, 255, 255, 0.75)",
        "countText": "rgba(255, 255, 255, 0.65)"
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
        "tv": false
      },
      "enabled": false,
      "areas": {
        "left": {
          "enabled": true,
          "showServiceInfo": true,
          "contentAlign": "left"
        },
        "center": {
          "enabled": true,
          "showServiceInfo": false,
          "contentAlign": "right"
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
