require('test-flumelog')(function () {
  return require('../')('/tmp/test_flumelog-memory'+Date.now())
}, function () {
  console.log('done')
})

