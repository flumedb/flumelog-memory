'use strict'
var Obv = require('obv')
var Append = require('append-batch')
var pull = require('pull-stream')
var File = require('pull-file')
var Split = require('pull-split')
var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')
var pullCursor = require('pull-cursor')

//a fake log that is all in memory.
//could extend this to be an append only json log, that got saved and recovered from disk, too
//and that might be useful because it would be a less code than offset log and thus easier to think about.


//TODO: take an optional file name, and if provided, persist to an line delimited json file.
module.exports = function (filename) {

  var log = [], since = Obv(), last

  //scan the whole log, and set the last value...
  if(filename) {
    mkdirp(path.dirname(filename), function () {
      pull(
        File(filename),
        Split('\n', JSON.parse, false, true),
        pull.drain(function (data) {
          last = log.push(data.value) - 1
        }, function (err) {
          if(err) since.set(-1)
          else since.set(last == null ?  -1 : last)
        })
      )
    })
  }
  else
    since.set(-1)

  var append = Append(function (batch, cb) {
    var last = log.length
    if(!filename) next()
    else fs.appendFile(filename, batch.map(function (e, i) {
      return {seq: last + i, value: e}
    }).map(JSON.stringify).join('\n')+'\n', next)

    function next(err) {
      if(err) return cb(err)
      batch.forEach(function (v) { log.push(v) })
      since.set(log.length - 1)
      cb(null, since.value)
    }
  })

  var createStream = pullCursor(since, function (index, cb) {
    cb(null, log[index], index-1, index+1)
  })

  return {
    filename: filename,
    get: function (n, cb) {
      if(n > log.length || n < 0) return cb(new Error('not found'))
      else cb(null, log[n])
    },

    since: since,

    stream: function (opts) {
      return createStream(opts)
    },
    append: append,
    close: function (cb) {
      cb()
    }
  }
}

