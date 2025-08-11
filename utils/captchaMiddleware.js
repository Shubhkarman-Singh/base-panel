const axios = require('axios');
const { db } = require('../handlers/db.js');
const log = new (require("cat-loggr"))();

/**
 * Middleware to add captcha settings to response locals
 */
async function addCaptchaToLocals(req, res, next) {
  try {
    const captchaSettings = (await db.get("captcha_settings")) || {};
    res.locals.captchaSettings = captchaSettings;
    next();
  } catch (error) {
    log.error("Error fetching captcha settings:", error);
    res.locals.captchaSettings = {};
    next();
  }
}

/**
 * Middleware to verify reCAPTCHA token
 */
async function verifyCaptcha(req, res, next) {
  try {
    const captchaSettings = (await db.get("captcha_settings")) || {};
    
    // Skip verification if captcha is disabled
    if (!captchaSettings.enabled) {
      return next();
    }

    const captchaToken = req.body['g-recaptcha-response'];
    
    if (!captchaToken) {
      log.warn('CAPTCHA token missing for request to:', req.path);
      // Redirect back with error based on the route
      if (req.path.includes('login')) {
        return res.redirect('/login?err=CaptchaRequired');
      } else if (req.path.includes('register')) {
        return res.redirect('/register?err=CaptchaRequired');
      } else if (req.path.includes('reset-password')) {
        return res.redirect('/auth/reset-password?err=CaptchaRequired');
      }
      return res.redirect(req.get('Referer') || '/auth?err=CaptchaRequired');
    }

    // Verify with Google reCAPTCHA
    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const verificationData = {
      secret: captchaSettings.secretKey,
      response: captchaToken,
      remoteip: req.ip
    };

    const response = await axios.post(verificationUrl, null, {
      params: verificationData
    });

    if (!response.data.success) {
      log.warn('CAPTCHA verification failed:', response.data);
      // Redirect back with error based on the route
      if (req.path.includes('login')) {
        return res.redirect('/login?err=CaptchaFailed');
      } else if (req.path.includes('register')) {
        return res.redirect('/register?err=CaptchaFailed');
      } else if (req.path.includes('reset-password')) {
        return res.redirect('/auth/reset-password?err=CaptchaFailed');
      }
      return res.redirect(req.get('Referer') || '/auth?err=CaptchaFailed');
    }

    // Optional: Verify domain if enabled
    if (captchaSettings.verifyDomain && response.data.hostname) {
      const expectedHostname = req.get('host').split(':')[0];
      if (response.data.hostname !== expectedHostname) {
        log.warn('CAPTCHA domain mismatch:', {
          expected: expectedHostname,
          received: response.data.hostname
        });
        // Redirect back with error based on the route
        if (req.path.includes('login')) {
          return res.redirect('/login?err=CaptchaDomainFailed');
        } else if (req.path.includes('register')) {
          return res.redirect('/register?err=CaptchaDomainFailed');
        } else if (req.path.includes('reset-password')) {
          return res.redirect('/auth/reset-password?err=CaptchaDomainFailed');
        }
        return res.redirect(req.get('Referer') || '/auth?err=CaptchaDomainFailed');
      }
    }

    next();
  } catch (error) {
    log.error("Error verifying CAPTCHA:", error);
    // Redirect back with error based on the route
    if (req.path.includes('login')) {
      return res.redirect('/login?err=CaptchaError');
    } else if (req.path.includes('register')) {
      return res.redirect('/register?err=CaptchaError');
    } else if (req.path.includes('reset-password')) {
      return res.redirect('/auth/reset-password?err=CaptchaError');
    }
    return res.redirect(req.get('Referer') || '/auth?err=CaptchaError');
  }
}

module.exports = {
  addCaptchaToLocals,
  verifyCaptcha
};