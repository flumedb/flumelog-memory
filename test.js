require('test-flumelog')(require('./')())

require('test-flumelog')(require('./')('/tmp/test_flumelog-memory'+Date.now()))
