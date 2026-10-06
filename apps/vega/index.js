// Antes que todo: crypto.getRandomValues (CryptoJS lo busca al cargarse) y
// después los adaptadores de @appvideo/core.
import './src/polyfills/getRandomValues';
import './src/bootstrap';
import {AppRegistry, LogBox} from 'react-native';
import {App} from './src/App';
import {name as appName} from './app.json';

LogBox.ignoreAllLogs();

AppRegistry.registerComponent(appName, () => App);
