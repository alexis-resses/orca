<?php

declare(strict_types=1);

use App\Greeter;
use App\Service\Mailer;

$greeter = new Greeter();
echo $greeter->greet('Orca');

$mailer = new Mailer($greeter);
echo $mailer->welcome('orca@example.com');
