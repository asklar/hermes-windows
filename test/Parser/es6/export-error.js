/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// RUN: (! %hermesc -commonjs -pretty-json %s 2>&1 ) | %FileCheck --match-full-lines %s

export { implements as x };
// CHECK: {{.*}}/export-error.js:10:10: error: Invalid exported name
// CHECK-NEXT: export { implements as x };
// CHECK-NEXT:          ^~~~~~~~~~

export { implements };
// CHECK: {{.*}}/export-error.js:15:10: error: Invalid exported name
// CHECK-NEXT: export { implements };
// CHECK-NEXT:          ^~~~~~~~~~

export { return };
// CHECK: {{.*}}/export-error.js:20:10: error: Invalid exported name
// CHECK-NEXT: export { return };
// CHECK-NEXT:          ^~~~~~

export { let };
// CHECK: {{.*}}/export-error.js:25:10: error: Invalid exported name
// CHECK-NEXT: export { let };
// CHECK-NEXT:          ^~~
