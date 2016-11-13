'use strict'
var Obv = require('obv')
var Append = require('append-batch')
var pull = require('pull-stream')
var File = require('pull-file')
var Split = require('pull-split')
var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')

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

  return {
    dir: null,
    get: function (n, cb) {
      if(n > log.length || n < 0) return cb(new Error('not found'))
      else cb(null, log[n])
    },

    since: since,

    stream: function (opts) {
      opts = opts || {}
      var cleanup, _cb
      var reverse = opts.reverse
      var min  = opts.gt != null ? opts.gt + 1 : opts.gte != null ? opts.gte : 0
      var max  = opts.lt != null ? opts.lt - 1 : opts.lte != null ? opts.lte : null
      var cursor = reverse ? max || log.length - 1 : min
      var values = opts.values !== false, seqs = opts.seqs !== false
      var live = opts.live === true

      function inc () {
        var _cursor = cursor
        cursor += reverse ? -1 : 1
        return _cursor
      }

      function get(seq) {
        if(seqs && values) return {seq: seq, value: log[seq]}
        else if(seqs) return seq
        else return log[seq]
      }

      return function (abort, cb) {
        if(abort) {
          if(cleanup) {cleanup(); _cb(abort) }
          return cb(abort)
        }
        else if (cursor < min) cb(true)
        else if(!live && cursor > (max === null ? log.length-1 : max)) cb(true)
        else if(cursor >= log.length) {
          if(live) {
            _cb = cb
            cleanup = since.once(function next (value) {
              cleanup = null
              if(value === -1) since.once(next, false)
              else cb(null, get(inc()))
            }, false)
          }
          else     cb(true)
        }
        else cb(null, get(inc()))
      }
    },
    append: append
  }
}

