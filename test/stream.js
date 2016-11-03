
var pull = require('pull-stream')
var tape = require('tape')

var Log = require('../')

tape('stream forward and backward', function (t) {

  var log = Log()

  function assertStream (opts, expected) {
    pull(log.stream(opts), pull.collect(function (err, ary) {
      if(err) throw err
      t.deepEqual(ary, expected)
    }))
  }

  function values (ary) {
    return ary.map(function (e) { return e.value })
  }
  function seqs (ary) {
    return ary.map(function (e) { return e.seq })
  }

  var expected = [
    {seq: 0, value: 'a'},
    {seq: 1, value: 'b'},
    {seq: 2, value: 'c'}
  ]

  t.test('empty stream', function (t) {
    assertStream({}, [])
    t.end()
  })

  t.test('since is null - to represent empty', function (t) {
    t.equal(log.since.value, -1)
    t.end()
  })

  t.test('stream with 3 items', function (t) {

    //since it's a batch, update at once.
    log.since.once(function (v) { t.equal(v, 2) }, false)

    log.append(['a','b','c'], function (err, seq) {
      if(err) throw err
      t.equal(seq, 2)
      t.equal(log.since.value, 2)

      assertStream({seqs: false}, values(expected))
      assertStream({gt: 0, seqs: false}, values(expected.slice(1)))
      assertStream({gt: 0, reverse: true, seqs: false}, values(expected.slice(1)).reverse())
      assertStream({gte: 0, seqs:false}, values(expected))
      assertStream({lt: 2, seqs: false}, values(expected.slice(0, 2)))

      assertStream({},                     (expected))
      assertStream({gt: 0},                (expected.slice(1)))
      assertStream({gt: 0, reverse: true}, (expected.slice(1)).reverse())
      assertStream({gte: 0},               (expected))
      assertStream({lt: 2},                (expected.slice(0, 2)))

      assertStream({values: false},                       seqs(expected))
      assertStream({gt: 0, values: false},                seqs(expected.slice(1)))
      assertStream({gt: 0, reverse: true, values: false}, seqs(expected.slice(1)).reverse())
      assertStream({gte: 0, values: false},               seqs(expected))
      assertStream({lt: 2, values: false},                seqs(expected.slice(0, 2)))

      t.equal(log.since.value, 2)

      t.end()
    })

  })

  t.test('since is null - to represent empty', function (t) {
    t.equal(log.since.value, 2)
    t.end()
  })

  tape('get', function (t) {
    pull(
      log.stream({seqs: true, values: false}),
      pull.asyncMap(function (seq, cb) {
        log.get(seq, cb)
      }),
      pull.collect(function (err, ary) {
        if(err) throw err
        t.deepEqual(ary, ['a', 'b', 'c'])
      })
    )

    t.end()
  })

  tape('live', function (t) {
    var seen = [], source, ended = 0
    pull(
      source = log.stream({live: true, seqs: false}),
      pull.drain(function (a) {
        seen.push(a)
      }, function () {
        ended ++
      })
    )

    log.append(['d'], function (err, seq) {
      if(err) throw err
      t.equal(seq, 3)
      t.deepEqual(seen, ['a', 'b', 'c', 'd'])

      source(true, function () {
        t.equal(ended, 1)
        log.append('e', function (err, seq) {
          t.equal(ended, 1, 'ended only once')
          t.equal(seq, 4)
          t.end()
        })

      })
    })
  })
})

