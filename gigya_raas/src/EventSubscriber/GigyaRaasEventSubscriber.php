<?php

namespace Drupal\gigya_raas\EventSubscriber;

use Drupal\Core\Database\Database;
use Drupal\gigya_raas\Helper\GigyaRaasHelper;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\HttpKernel\Event\GetResponseEvent;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

class GigyaRaasEventSubscriber implements EventSubscriberInterface {

	/**
	 * @param GetResponseEvent $event
	 */
	public function onLoad(GetResponseEvent $event) {
		/* Get necessary parameters from outside the class */
		/** @var SessionInterface $gigya_raas_session */
		$gigya_raas_session = \Drupal::service('user.private_tempstore')->get('gigya_raas');
		$current_user = \Drupal::currentUser();
		$uid = $current_user->id();

		/* User is logged in */
		if ($uid and !$current_user->hasPermission('bypass gigya raas')) {
			$session_params = GigyaRaasHelper::getSessionConfig(); //// @TODO add remember me

			if ($session_params['type'] === 'dynamic') {
				$this->handleDynamicSession($session_params, $gigya_raas_session);
			}
			elseif ($session_params['type'] === 'fixed') {
				$this->handleFixedSession($gigya_raas_session, $uid);
			}
		}
	}

	/**
	 * {@inheritdoc}
	 */
	public static function getSubscribedEvents() {
		$events[KernelEvents::REQUEST][] = ['onLoad'];

		return $events;
	}

	/**
	 * @param array $session_params
	 * @param SessionInterface $gigya_raas_session
	 */
	private function handleDynamicSession($session_params, $gigya_raas_session) {
		$cached_session_expiration = $gigya_raas_session->get('session_expiration');
		$new_session_expiration = time() + $session_params['time'];
		$prev_session_expiration = (empty($cached_session_expiration) or $cached_session_expiration == -1) ? $new_session_expiration : $cached_session_expiration;

		if ($prev_session_expiration < time()) {
			user_logout();
		}

		$gigya_raas_session->set('session_expiration', $new_session_expiration);
	}

	/**
	 * @param SessionInterface $gigya_raas_session
	 * @param int $uid
	 */
	public function handleFixedSession($gigya_raas_session, $uid) {
		$cached_session_expiration = $gigya_raas_session->get('session_expiration');
		$session_expiration = NULL;

		/* Session expiration is "cached" to reduce DB requests. It can only be empty under "fixed session" */
		if (empty($cached_session_expiration)) {
			$error_message = 'Gigya session information could not be retrieved from the database. It is likely that the Gigya RaaS module has not been installed correctly. Please attempt to reinstall it. Attempted to retrieve details for user ID: ' . $uid;

			try {
				$session_expiration_row = Database::getConnection()->query('SELECT expiration FROM {sessions} s WHERE s.uid = :uid', [':uid' => $uid])->fetchAssoc();
				if (!isset($session_expiration_row['expiration'])) {
					\Drupal::logger('gigya_raas')->error($error_message);
				}
				else {
					$gigya_raas_session->set('session_expiration', $session_expiration_row['expiration']);
				}
			} catch (\Exception $e) {
				\Drupal::logger('gigya_raas')->error($error_message . PHP_EOL . 'Exception of type: ' . get_class($e) . ', exception error message: ' . $e->getMessage());
				user_logout();
			}
		}
		/* Right after logging in, the session expiration exists, but isn't yet written to the DB--but by the time this request is executed, it is already written, so it's possible to update the DB. */
		else {
			$session_expiration = $cached_session_expiration;

			if ($gigya_raas_session->get('session_registered') === FALSE) {
				Database::getConnection()->query('UPDATE {sessions} s SET expiration = ' . $session_expiration . ' WHERE s.uid = :uid', [':uid' => $uid]);

				$gigya_raas_session->set('session_registered', TRUE);
			}

			if ($session_expiration < time()) {
				user_logout();
			}
		}
	}
}