var urllib = require('urllib');
var wrapper = require('./util').wrapper;
var extend = require('util')._extend;

var ComponentAccessToken = function (data) {
  if (!(this instanceof ComponentAccessToken)) {
    return new ComponentAccessToken(data);
  }
  this.data = data;
};


/**
 * 检查ComponentAccessToken是否有效
 */
ComponentAccessToken.prototype.isValid = function () {
  return !!this.data.component_access_token && (new Date().getTime()) < this.expire_at;
};


/**
 * 根据appid和appsecret创建Auth的构造函数
 * @param {String} appid 在开放平台申请得到的第三方平台appid
 * @param {String} appsecret 在开放平台申请得到的第三方平台appsecret
 * @param {Function} getVerifyTicket 获取全局component_verify_token的方法，建议存放在缓存中
 */
var Auth = function (appid, appsecret, getVerifyTicket, getComponentToken, saveComponentToken) {
  this.appid = appid;
  this.appsecret = appsecret;
  this.getVerifyTicket = getVerifyTicket;
  this.getComponentToken = getComponentToken;
  this.saveComponentToken = saveComponentToken;
  this.prefix = 'https://api.weixin.qq.com/cgi-bin/component/';
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
 * 应用开发者不需直接调用本API
 *
 * @param {Function} callback 回调函数
 */
Auth.prototype.getComponentAccessToken = function (callback) {
  var that = this;
  var url = this.prefix + 'api_component_token';
  var params = {
    component_appid: this.appid,
    component_appsecret: this.appsecret,
    component_verify_ticket: this.getVerifyTicket()
  };
  var args = {
    method: post,
    data: params,
    dataType: 'json'
  };
  this.request(url, args, wrapper(function(err, data) {
    if (err) {
      return callback(err);
    }
    // 过期时间，因网络延迟等，将实际过期时间提前100秒
    var expireTime = (new Date().getTime()) + (data.expires_in - 100) * 1000;
    data.expires_at = expireTime;
    var token = ComponentAccessToken(data);
    that.saveToken(token, function (err) {
      if (err) {
        return callback(err); 
      }
    });
  }));
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
  var url = this.prefix + 'api_create_preauthcode?component_access_token' + this.getComponentToken();
  var params = {
    component_appid: this.appid
  };
  var args = {
    method: post,
    data: params,
    dataType: 'json'
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
  var url = this.prefix + 'api_query_auth?component_access_token' + this.getComponentToken();
  var params = {
    component_appid: this.appid,
    authorization_code: auth_code
  };
  var args = {
    method: post,
    data: params,
    dataType: 'json'
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
  var url = this.prefix + 'api_authorizer_token?component_access_token' + this.getComponentToken();
  var params = {
    component_appid: this.appid,
    authorizer_appid: authorizer_appid,
    authorizer_refresh_token: authorizer_refresh_token
  };
  var args = {
    method: post,
    data: params,
    dataType: 'json'
  };
  this.request(url, args, wrapper(callback));
};


/*
 * 获取授权方的公众账号基本信息
 *
 * Result参见:
 * https://open.weixin.qq.com/cgi-bin/showdocument?action=dir_list&id=open1453779503
 *
 * @param {String} authorizer_appid 授权方appid
 * @param {Function} callback 回调函数
 */
Auth.prototype.getAuthInfo = function(authorizer_appid, callback) {
  var url = this.prefix + 'api_get_authorizer_info?component_access_token' + this.getComponentToken();
  var params = {
    component_appid: this.appid,
    authorizer_appid: authorizer_appid
  };
  var args = {
    method: post,
    data: params,
    dataType: 'json'
  };
  this.request(url, args, wrapper(callback));
};

module.exports = Auth;
