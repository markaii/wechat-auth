# wechat-auth

[![Build Status](https://travis-ci.org/markaii/wechat-auth.svg?branch=master)](https://travis-ci.org/markaii/wechat-auth)
[![Dependencies Status](https://david-dm.org/markaii/wechat-auth.svg)](https://david-dm.org/markaii/wechat-auth)


(nodejs)微信公众号第三方平台授权sdk

针对微信公众号第三方开发者，封装了授权流程中的主要api,
详情见微信开放平台文档[授权流程说明](https://open.weixin.qq.com/cgi-bin/showdocument?action=dir_list&t=resource/res_list&verify=1&id=open1453779503&token=e7e06f30f4625f3274a06dd29b07d76f8aa00da7&lang=zh_CN)。

该模块主要参考了[node-webot](https://github.com/node-webot)的[wechat-oauth](https://github.com/node-webot/wechat-oauth)
和[wechat-api](https://github.com/node-webot/wechat-api)

## 功能列表

- 获取第三方平台component_access_token
- 获取预授权码pre_auth_code
- 获取公众号的接口调用凭据和授权信息
- 刷新授权公众号的接口调用凭据
- 获取授权公众号账号基本信息

## 安装

```
$ npm install wechat-auth
```

## 使用方法

使用该插件需要自己缓存微信第三方平台所需的`component_verify_ticket`,
`component_access_token`，建议存储在redis中，参考以下方法创建授权对象实例：

    var WXAuth = require('wechat-auth');

    /*
     * 获取全局component_verify_ticket的方法
     * 从redis缓存中读取
     */
    var getVerifyTicket = function(callback) {
      return redisClient.get('component_verify_ticket', function(err, ticket) {
        if (err) {
          return callback(err);
        } else if (!ticket) {
          return callback(new Error('no component_verify_ticket'));
        } else {
          return callback(null, ticket);
        }
      });
    };

    /*
     * 获取全局component_access_token的方法
     * 从redis缓存中读取
     */
    var getComponentToken = function(callback) {
      return redisClient.get('component_access_token', function(err, token) {
        if (err) {
          return callback(err);
        } else {
          return callback(null, token);
        }
      });
    };

    /*
     * 保存component_access_token到redis中
     */
    var saveComponentToken = function(token, callback) {
      return redisClient.set('component_access_token', token, function(err, reply) {
        if (err) {
          callback(err);
        }
        redisClient.expire('component_access_token', 7000);
        return callback(null);
      });
    };

    var wxauth = new WXAuth(appid, appsecret, getVerifyTicket, getComponentToken, saveComponentToken);

### 获取第三方平台component_access_token

    wxauth.getLatestComponentToken(function(err, token) {
      // TODO
    });

### 获取预授权码pre_auth_code

    wxauth.getPreAuthCode(function(err, reply) {
      // TODO
    });

### 获取公众号的接口调用凭据和授权信息

    // auth_code 授权完成后微信返回的授权码
    wxauth.getAuthToken(auth_code, function(err, reply) {
      // TODO
    });

### 刷新授权公众号的接口调用凭据

    // authorizer_appid 授权公众号的appid
    // authorizer_refresh_token 从微信获取的公众号刷新token，存储在db中
    wxauth.refreshAuthToken(authorizer_appid, authorizer_refresh_token, function(err, reply) {
      // TODO
    });

### 获取授权公众号账号基本信息

    // authorizer_appid 授权公众号的appid
    wxauth.getAuthInfo(authorizer_appid, function(err, reply) {
      // TODO
    });

## Licence

MIT
