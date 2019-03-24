require('test-flumelog')(function (file, seed) {
  return require('../')(file)
}, function () {
  console.log('done')
})



