var urllib = require('urllib');
var wrapper = require('./util').wrapper;
var extend = require('util')._extend;
var querystring = require('querystring');

var ComponentAccessToken = function (data) {
  if (!(this instanceof ComponentAccessToken)) {
    return new ComponentAccessToken(data);
  }
  this.component_access_token = data.component_access_token;
  this.expires_at = data.expires_at;
};


/**
 * 检查ComponentAccessToken是否有效
 */
ComponentAccessToken.prototype.isValid = function () {
  return !!this.component_access_token && (new Date().getTime()) < this.expires_at;
};


/**
 * 根据appid和appsecret创建Auth的构造函数
 * @param {String} appid 在开放平台申请得到的第三方平台appid
 * @param {String} appsecret 在开放平台申请得到的第三方平台appsecret
 * @param {Function} getVerifyTicket 获取全局component_verify_ticket的方法，建议存放在缓存中, 必填项
 * @param {Function} getComponentToken 获取全局component_access_token的方法，选填项，多进程状态下应该存放在缓存中
 * @param {Function} saveComponentToken获取全局component_access_token的方法，选填项，多进程状态下应该存放在缓存中
 */
var Auth = function (appid, appsecret, getVerifyTicket, getComponentToken, saveComponentToken) {
  this.appid = appid;
  this.appsecret = appsecret;
  this.getVerifyTicket = getVerifyTicket;
  this.getComponentToken = getComponentToken || function (callback) {
    callback(null, this.store);
  };
  this.saveComponentToken = saveComponentToken || function (token, callback) {
    this.store = token;
    if (process.env.NODE_ENV === 'production') {
      console.warn('Don\'t save token in memory, when cluster or multi-computer!');
    }
    callback(null);
  };
  this.prefix = 'https://api.weixin.qq.com/cgi-bin/component/';
  this.snsPrefix = 'https://api.weixin.qq.com/sns/';
};


/**
 * 封装urllib请求
 *
 * @param {String} url 请求路径
 * @param {Object} opts urllib选项
 * @param {Function} callback 回调函数
 */
Auth.prototype.request = function (url, opts, callback) {
  var options = {};
  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }
  for (var key in opts) {
    if (key !== 'headers') {
      options[key] = opts[key];
    } else {
      if (opts.headers) {
        options.headers = options.headers || {};
        extend(options.headers, opts.headers);
      }
    }
  }
  urllib.request(url, options, callback);
};


/*
 * 根据创建auth实例时传入的appid和appsecret获取component_access_token
 * 进行后续所有API调用时，需要先获取这个token
 *
 * 应用开发者不需直接调用本API
 *
 * @param {Function} callback 回调函数
 */
Auth.prototype.getComponentAccessToken = function (callback) {
  var that = this;
  var url = this.prefix + 'api_component_token';
  this.getVerifyTicket(function(err, verifyTicket) {
    if (err) {
      return callback(err);
    }
    var params = {
      component_appid: that.appid,
      component_appsecret: that.appsecret,
      component_verify_ticket: verifyTicket
    };
    var args = {
      method: 'post',
      data: params,
      dataType: 'json',
      contentType: 'json'
    };
    that.request(url, args, wrapper(function(err, token) {
      if (err) {
        return callback(err);
      }
      // 过期时间，因网络延迟等，将实际过期时间提前100秒
      var expireTime = (new Date().getTime()) + (token.expires_in - 100) * 1000;
      token.expires_at = expireTime;
      that.saveComponentToken(token, function (err) {
        if (err) {
          return callback(err); 
        }
        callback(err, token);
      });
    }));
  });
};


/*!
 * 需要component_access_token的接口调用如果采用preRequest进行封装后，就可以直接调用。
 * 无需依赖getComponentAccessToken为前置调用。
 * 应用开发者无需直接调用此API。
 *
 * Examples:
 * ```
 * auth.preRequest(method, arguments);
 * ```
 * @param {Function} method 需要封装的方法
 * @param {Array} args 方法需要的参数
 */
Auth.prototype.preRequest = function (method, args, retryed) {
  var that = this;
  var callback = args[args.length - 1];
  // 调用用户传入的获取token的异步方法，获得token之后使用（并缓存它）。
  that.getComponentToken(function (err, token) {
    if (err) {
      return callback(err);
    }
    var accessToken;
    // 有token并且token有效直接调用
    if (token && (accessToken = ComponentAccessToken(token)).isValid()) {
      // 暂时保存token
      that.token = token;
      if (!retryed) {
        var retryHandle = function (err, data, res) {
          // 40001 重试
          if (data && data.errcode && data.errcode === 40001) {
            return that.preRequest(method, args, true);
          }
          callback(err, data, res);
        };
        // 替换callback
        var newargs = Array.prototype.slice.call(args, 0, -1);
        newargs.push(retryHandle);
        method.apply(that, newargs);
      } else {
        method.apply(that, args);
      }
    } else {
      // 从微信获取获取token
      that.getComponentAccessToken(function (err, token) {
        // 如遇错误，通过回调函数传出
        if (err) {
          return callback(err);
        }
        // 暂时保存token
        that.token = token;
        method.apply(that, args);
      });
    }
  });
};


/*
 * 获取最新的component_access_token
 * 该接口用于开发者调用
 *
 * Examples:
 * ```
 * auth.getLatestComponentToken(callback);
 * ```
 * callback:
 *
 * - `err`, 出现异常时的异常对象
 * - `token`, 获取的component_access_token
 *
 * @param {Function} callback 回调函数
 */
Auth.prototype.getLatestComponentToken = function (callback) {
  var that = this;
  // 调用用户传入的获取token的异步方法，获得token之后使用（并缓存它）。
  this.getComponentToken(function (err, token) {
    if (err) {
      return callback(err);
    }
    var accessToken;
    if (token && (accessToken = ComponentAccessToken(token)).isValid()) {
      callback(null, token);
    } else {
      // 使用appid/appsecret获取token
      that.getComponentAccessToken(callback);
    }
  });
};


/*
 * 获取预授权码pre_auth_code
 * 
 * Result:
 * ```
 * {"pre_auth_code": "PRE_AUTH_CODE", "expires_in": 600}
 * ```
 * 开发者需要检查预授权码是否过期
 *
 * @param {Function} callback 回调函数
 */
Auth.prototype.getPreAuthCode = function(callback) {
  this.preRequest(this._getPreAuthCode, arguments);
};

/*!
 * 获取预授权码的未封装版本
 */
Auth.prototype._getPreAuthCode = function(callback) {
  var url = this.prefix + 'api_create_preauthcode?component_access_token=' + this.token.component_access_token;
  var params = {
    component_appid: this.appid
  };
  var args = {
    method: 'post',
    data: params,
    dataType: 'json',
    contentType: 'json'
  };
  this.request(url, args, wrapper(callback));
};


/*
 * 使用授权码换取公众号的接口调用凭据和授权信息
 * 这个接口需要在用户授权回调URI中调用，拿到用户公众号的调用
 * 凭证并保持下来（缓存or数据库）
 * 仅需在授权的时候调用一次
 *
 * Result:
 * ```
 * {
 *   "authorization_info": {
 *     "authorizer_appid": "wxf8b4f85f3a794e77",
 *     "authorizer_access_token": "AURH_ACCESS_CODE",
 *     "expires_in": 7200,
 *     "authorizer_refresh_token": "AUTH_REFRESH_TOKEN",
 *     "func_info": [
 *     ]
 *   }
 * }
 *
 * @param {String} auth_code 授权码
 * @param {Function} callback 回调函数
 */
Auth.prototype.getAuthToken = function(auth_code, callback) {
  this.preRequest(this._getAuthToken, arguments);
};

/*!
 * 获取授权信息的未封装版本
 */
Auth.prototype._getAuthToken = function(auth_code, callback) {
  var url = this.prefix + 'api_query_auth?component_access_token=' + this.token.component_access_token;
  var params = {
    component_appid: this.appid,
    authorization_code: auth_code
  };
  var args = {
    method: 'post',
    data: params,
    dataType: 'json',
    contentType: 'json'
  };
  this.request(url, args, wrapper(callback));
};



/*
 * 获取（刷新）授权公众号的接口调用凭据（Token）
 * 这个接口应该由自动刷新授权授权方令牌的代码调用
 *
 * Result:
 * ```
 * {
 *   "authorizer_access_token": "AURH_ACCESS_CODE",
 *   "expires_in": 7200,
 *   "authorizer_refresh_token": "AUTH_REFRESH_TOKEN",
 * }
 *
 * @param {String} authorizer_appid 授权方appid
 * @param {String} authorizer_refresh_token 授权方的刷新令牌
 * @param {Function} callback 回调函数
 */
Auth.prototype.refreshAuthToken = function(authorizer_appid, authorizer_refresh_token, callback) {
  this.preRequest(this._refreshAuthToken, arguments); 
};

/*!
 * 未封装的刷新接口调用凭据接口
 */
Auth.prototype._refreshAuthToken = function(authorizer_appid, authorizer_refresh_token, callback) {
  var url = this.prefix + 'api_authorizer_token?component_access_token=' + this.token.component_access_token;
  var params = {
    component_appid: this.appid,
    authorizer_appid: authorizer_appid,
    authorizer_refresh_token: authorizer_refresh_token
  };
  var args = {
    method: 'post',
    data: params,
    dataType: 'json',
    contentType: 'json'
  };
  this.request(url, args, wrapper(callback));
};


/*
 * 获取授权方的公众账号基本信息
 *
 * @param {String} authorizer_appid 授权方appid
 * @param {Function} callback 回调函数
 */
Auth.prototype.getAuthInfo = function(authorizer_appid, callback) {
  this.preRequest(this._getAuthInfo, arguments);
};

/*!
 * 未封装的获取公众账号基本信息接口
 */
Auth.prototype._getAuthInfo = function(authorizer_appid, callback) {
  var url = this.prefix + 'api_get_authorizer_info?component_access_token=' + this.token.component_access_token;
  var params = {
    component_appid: this.appid,
    authorizer_appid: authorizer_appid
  };
  var args = {
    method: 'post',
    data: params,
    dataType: 'json',
    contentType: 'json'
  };
  this.request(url, args, wrapper(callback));
};


/*
 * 获取授权方的选项设置信息
 *
 * @param {String} authorizer_appid 授权方appid
 * @param {String} option_name 选项名称
 * @param {Function} callback 回调函数
 */
Auth.prototype.getAuthOption = function(authorizer_appid, option_name, callback) {
  this.preRequest(this._getAuthOption, arguments);
};

/*!
 * 未封装的获取授权方选项信息
 */
Auth.prototype._getAuthOption = function(authorizer_appid, option_name, callback) {
  var url = this.prefix + 'api_get_authorizer_option?component_access_token=' + this.token.component_access_token;
  var params = {
    component_appid: this.appid,
    authorizer_appid: authorizer_appid,
    option_name: option_name
  };
  var args = {
    method: 'post',
    data: params,
    dataType: 'json',
    contentType: 'json'
  };
  this.request(url, args, wrapper(callback));
};


/*
 * 设置授权方的选项信息
 *
 * @param {String} authorizer_appid 授权方appid
 * @param {String} option_name 选项名称
 * @param {String} option_value 选项值
 * @param {Function} callback 回调函数
 */
Auth.prototype.setAuthOption = function(authorizer_appid, option_name, option_value, callback) {
  this.preRequest(this._setAuthOption, arguments);
};

/*!
 * 未封装的设置授权方选项信息
 */
Auth.prototype._setAuthOption = function(authorizer_appid, option_name, option_value, callback) {
  var url = this.prefix + 'api_set_authorizer_option?component_access_token=' + this.token.component_access_token;
  var params = {
    component_appid: this.appid,
    authorizer_appid: authorizer_appid,
    option_name: option_name,
    option_value: option_value
  };
  var args = {
    method: 'post',
    data: params,
    dataType: 'json',
    contentType: 'json'
  };
  this.request(url, args, wrapper(callback));
};


/****************** 以下是网页授权相关的接口******************/

/**
 * 获取授权页面的URL地址
 * @param {String} appid 授权公众号的appid
 * @param {String} redirect 授权后要跳转的地址
 * @param {String} state 开发者可提供的数据
 * @param {String} scope 作用范围，值为snsapi_userinfo和snsapi_base，前者用于弹出，后者用于跳转
 */
Auth.prototype.getOAuthURL = function (appid, redirect, state, scope) {
  var url = 'https://open.weixin.qq.com/connect/oauth2/authorize';
  var info = {
    appid: appid,
    redirect_uri: redirect,
    response_type: 'code',
    scope: scope || 'snsapi_base',
    state: state || '',
    component_appid: this.appid
  };

  return url + '?' + querystring.stringify(info) + '#wechat_redirect';
};


/*
 * 根据授权获取到的code，换取access_token和openid
 *
 * @param {String} appid 授权公众号的appid
 * @param {String} code 授权获取到的code
 * @param {Function} callback 回调函数
 */
Auth.prototype.getOAuthAccessToken = function(appid, code, callback) {
  this.preRequest(this._getOAuthAccessToken, arguments);
};

/*!
 * 未封装的获取网页授权access_token方法
 */
Auth.prototype._getOAuthAccessToken = function(appid, code, callback) {
  var url = this.snsPrefix + 'oauth2/component/access_token';
  var params = {
    appid: appid,
    code: code,
    grant_type: 'authorization_code',
    component_appid: this.appid,
    component_access_token: this.token.component_access_token
  };
  var args = {
    method: 'get',
    data: params,
    dataType: 'json'
  };
  this.request(url, args, wrapper(callback));
};


/*
 * 刷新网页授权的access_token
 *
 * @param {String} appid 授权公众号的appid
 * @param {String} refresh_token 授权刷新token
 * @param {Function} callback 回调函数
 */
Auth.prototype.refreshOAuthAccessToken = function(appid, refresh_token, callback) {
  this.preRequest(this._refreshOAuthAccessToken, arguments);
};

/*!
 * 未封装的刷新网页授权access_token方法
 */
Auth.prototype._refreshOAuthAccessToken = function(appid, refresh_token, callback) {
  var url = this.snsPrefix + 'oauth2/component/refresh_token';
  var params = {
    appid: appid,
    refresh_token: refresh_token,
    grant_type: 'refresh_token',
    component_appid: this.appid,
    component_access_token: this.token.component_access_token
  };
  var args = {
    method: 'get',
    data: params,
    dataType: 'json'
  };
  this.request(url, args, wrapper(callback));
};


/*
 * 通过access_token获取用户基本信息
 *
 * @param {String} openid 授权用户的唯一标识
 * @param {String} access_token 网页授权接口调用凭证
 * @param {String} lang 返回国家地区语言版本，zh_CN 简体，zh_TW 繁体，en 英语
 * @param {Function} callback 回调函数
 */
Auth.prototype.getUserInfo = function (openid, access_token, lang, callback) {
  var url = this.snsPrefix + 'userinfo';
  var params = {
    openid: openid,
    access_token: access_token,
    lang: lang || 'en'
  };
  var args = {
    method: 'get',
    data: params,
    dataType: 'json'
  };
  this.request(url, args, wrapper(callback));
};
 

module.exports = Auth;
