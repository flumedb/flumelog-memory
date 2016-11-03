var Obv = require('obv')

//a fake log that is all in memory.
//could extend this to be an append only json log, that got saved and recovered from disk, too
//and that might be useful because it would be a less code than offset log and thus easier to think about.

module.exports = function () {

  var log = [], since = Obv()

  since.set(-1)

  return {

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
          if(cleanup) {cleanup(); _cb(abort)}
          return cb(abort)
        }
        else if (cursor < min) cb(true)
        else if(!live && cursor > (max === null ? log.length-1 : max)) cb(true)
        else if(cursor >= log.length) {
          if(live) {
            _cb = cb;
            cleanup = since.once(function (value) {
              cb(null, get(inc()))
            }, false)
          }
          else     cb(true)
        }
        else cb(null, get(inc()))
      }
    },
    append: function (value, cb) {
      if(Array.isArray(value))
        log = log.concat(value)
      else
        log.push(value)
      console.log(log)
      since.set(log.length - 1)
      cb(null, log.length - 1)
    }
  }
}

