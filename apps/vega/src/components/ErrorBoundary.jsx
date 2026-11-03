import * as React from 'react';
import {BackHandler, Text, View} from 'react-native';
import i18n from '@appvideo/core/locales/i18n';
import {FocusButton} from './FocusButton';
import {getTheme} from '../theme';
import {createScaledStyles} from '../scaledStyles';
import {devLog} from '../devLog';

/**
 * Captura fallos de render (como ErrorBoundary de la web). Sin esto, un error
 * en una pantalla deja la app en negro o la cierra.
 * `onRetry` debe llevar a un estado sano (App rearma la navegación); acá sólo se
 * limpia el error para volver a dibujar.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {error: null};
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return {error};
  }

  componentDidCatch(error, info) {
    devLog('ErrorBoundary:', error, info?.componentStack?.slice(0, 2000));
  }

  retry() {
    this.props.onRetry?.();
    this.setState({error: null});
  }

  render() {
    if (!this.state.error) return this.props.children;
    const theme = getTheme();
    return (
      <View style={[styles.root, {backgroundColor: theme.background || '#000'}]}>
        <Text style={[styles.title, {color: theme.text}]}>{i18n.t('errors.loadAppTitle')}</Text>
        <Text style={[styles.hint, {color: theme.text}]}>{i18n.t('errors.loadAppHint')}</Text>
        <View style={styles.actions}>
          <FocusButton label={i18n.t('common.retry')} onPress={this.retry} hasTVPreferredFocus primary />
          <FocusButton label={i18n.t('common.exit')} onPress={() => BackHandler.exitApp()} style={styles.secondButton} />
        </View>
      </View>
    );
  }
}

const styles = createScaledStyles({
  root: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 160},
  title: {fontSize: 40, fontWeight: '700', marginBottom: 20, textAlign: 'center'},
  hint: {fontSize: 26, opacity: 0.85, marginBottom: 48, textAlign: 'center'},
  actions: {flexDirection: 'row'},
  secondButton: {marginLeft: 24},
});
