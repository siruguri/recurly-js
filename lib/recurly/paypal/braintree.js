import loadScript from 'load-script';
import Emitter from 'component-emitter';
import errors from '../../errors';

/**
 * Braintree-specific PayPal handler
 *
 * TODO: make inherit from PayPal instead of Emitter to consolidate error handler and init
 */

export class BraintreePayPal extends Emitter {
  constructor (options) {
    super();
    this.ready = false;
    this.configure(options);
  }

  configure (options) {
    if (!options.braintree.clientAuthorization) {
      return this.error('paypal-config-missing', { opt: 'braintree.clientAuthorization'})
    }
    this.config.clientAuthorization = options.braintree.clientAuthorization;
    this.recurly = options.recurly;
    this.load();
  }

  load () {
    loadScript('https://js.braintreegateway.com/web/3.6.3/js/client.min.js', () => {
      loadScript('https://js.braintreegateway.com/web/3.6.3/js/paypal.min.js', () => {
        this.initialize();
      });
    });
  }

  initialize () {
    if (!global.braintree) return this.error('paypal-braintree-load-failure');

    let authorization = this.config.clientAuthorization;

    braintree.client.create({ authorization }, (err, client) => {
      if (err) return this.error('paypal-braintree-load-failure', { err });
      braintree.paypal.create({ client }, (err, paypal) => {
        if (err) return this.error('paypal-braintree-load-failure', { err });
        this.paypal = paypal;
        this.ready = true;
      });
    });
  }

  /**
   * Starts the PayPal flow
   * > must be on the call chain with a user interaction (click, touch) on it
   *
   * @emit 'paypal-braintree-tokenize-braintree-error'
   * @emit 'paypal-braintree-tokenize-recurly-error'
   * @emit 'token'
   */
  start () {
    if (!this.ready) return this.error('paypal-braintree-not-ready');

    // Tokenize with Braintree
    this.paypal.tokenize({ flow: 'vault' }, (err, payload) => {
      if (err) return this.error('paypal-braintree-tokenize-braintree-error', { err });

      // Tokenize with Recurly
      this.recurly.request('post', '/paypal/token', { payload }, (err, token) => {
        if (err) return this.error('paypal-braintree-tokenize-recurly-error', { err });
        this.emit('token', token);
      });
    });
  }

  /**
   * Creates and emits a RecurlyError
   *
   * @param  {...Mixed} params to be passed to the Recurlyerror factory
   * @return {RecurlyError}
   * @emit 'error'
   * @private
   */
  error (...params) {
    let err = params[0] instanceof Error ? params[0] : errors(...params);
    this.emit('error', err);
    return err;
  }
}
